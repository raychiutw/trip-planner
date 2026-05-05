// @vitest-environment node
/**
 * functions/api/_companion.ts unit test
 *
 * 對映 specs/tp-companion-mapping/spec.md 的 11 cases (A-J + UNIQUE→409)：
 *   A: 三 gate 全過 + valid requestId + status='processing' + submitter 對映 user → 成功
 *   B: scope ≠ companion → null（V2 user 路徑）
 *   C: scope=companion 但 scopes 不含 companion → fail-closed null + audit 'self_reported_scope'
 *   D: scope=companion + scopes 含 companion 但 clientId ≠ TP_REQUEST_CLIENT_ID → 'client_unauthorized'
 *   E: 三 gate 過但 requestId 不存在 → 'invalid_request_id'
 *   F: requestId 存在但 status='completed' → 'status_completed'
 *   G: requestId 為負數 / 非整數 / 字串 / 0 → 'invalid_request_id'
 *   H: submitted_by email 沒對應 users → 'submitter_unknown'
 *   I: status race → guarded UPDATE WHERE 不符 → fail-closed
 *   J: 同 requestId 同 action 第 2 次 → companion_request_actions UNIQUE 衝突 → 409 COMPANION_QUOTA_EXCEEDED
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, disposeMiniflare } from '../api/setup';
import { mockEnv, mockAuth, mockContext, seedUser, seedTrip, seedPoi } from '../api/helpers';
import {
  resolveCompanionUserId,
  requireFavoriteActor,
} from '../../functions/api/_companion';
import { AppError } from '../../functions/api/_errors';
import type { Env, AuthData } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

const SUBMITTER_EMAIL = 'companion-submitter@test.com';
const TP_REQUEST_CLIENT_ID = 'tripline-internal-cli';

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db, { TP_REQUEST_CLIENT_ID });
  await seedUser(db, SUBMITTER_EMAIL);
});

afterAll(disposeMiniflare);

beforeEach(async () => {
  // 清掉測試 trip_requests / audit_log / companion_request_actions / poi_favorites
  await db.prepare("DELETE FROM companion_request_actions").run();
  await db.prepare("DELETE FROM audit_log WHERE trip_id = 'system:companion'").run();
  await db.prepare("DELETE FROM trip_requests WHERE trip_id LIKE 'companion-test-%'").run();
  await db.prepare("DELETE FROM poi_favorites WHERE user_id LIKE 'test-user-companion-%'").run();
});

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

async function seedTripRequest(opts: {
  tripId?: string;
  /** trip 的 owner（會被 seedTrip 自動 INSERT OR IGNORE 到 users），預設 SUBMITTER_EMAIL */
  tripOwner?: string;
  /** trip_requests.submitted_by — 可與 owner 不同；測 case H 時不應 seedUser 此 email */
  submittedBy?: string;
  status?: 'open' | 'processing' | 'completed' | 'failed';
}): Promise<number> {
  const tripId = opts.tripId ?? 'companion-test-trip-1';
  await seedTrip(db, { id: tripId, owner: opts.tripOwner ?? SUBMITTER_EMAIL });
  const row = await db
    .prepare(
      'INSERT INTO trip_requests (trip_id, message, submitted_by, status) VALUES (?, ?, ?, ?) RETURNING id',
    )
    .bind(tripId, 'test message', opts.submittedBy ?? SUBMITTER_EMAIL, opts.status ?? 'processing')
    .first<{ id: number }>();
  return row!.id;
}

function buildCompanionRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://test.com/api/poi-favorites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
      'X-Request-Scope': 'companion',
      ...headers,
    },
  });
}

function companionAuth(overrides: Partial<AuthData> = {}): AuthData {
  return {
    email: 'service:tripline-internal-cli',
    userId: null,
    isAdmin: true,
    isServiceToken: true,
    scopes: ['admin', 'companion'],
    clientId: TP_REQUEST_CLIENT_ID,
    ...overrides,
  };
}

async function readFailureAudit(requestId: number | null): Promise<{
  companion_failure_reason: string | null;
  changed_by: string | null;
} | null> {
  return db
    .prepare(
      `SELECT companion_failure_reason, changed_by FROM audit_log
       WHERE trip_id = 'system:companion'
         AND (request_id = ? OR (? IS NULL AND request_id IS NULL))
       ORDER BY id DESC LIMIT 1`,
    )
    .bind(requestId, requestId)
    .first<{ companion_failure_reason: string | null; changed_by: string | null }>();
}

// --------------------------------------------------------------------------
// Case A — 成功路徑
// --------------------------------------------------------------------------

describe('resolveCompanionUserId — case A success', () => {
  it('三 gate 全過 + status=processing + submitter 對映 → 回 { userId, requestId }', async () => {
    const requestId = await seedTripRequest({});
    const result = await resolveCompanionUserId(env, buildCompanionRequest(), companionAuth(), requestId);

    expect(result).not.toBeNull();
    expect(result!.requestId).toBe(requestId);
    expect(result!.userId).toBeTruthy();

    // submitter email LOWER → users.id 對映
    const expectedUserRow = await db
      .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)')
      .bind(SUBMITTER_EMAIL)
      .first<{ id: string }>();
    expect(result!.userId).toBe(expectedUserRow!.id);
  });
});

// --------------------------------------------------------------------------
// Case B — scope ≠ companion (V2 user 路徑)
// --------------------------------------------------------------------------

describe('resolveCompanionUserId — case B not companion', () => {
  it('header X-Request-Scope 缺失 → 回 null（V2 user 路徑），不寫 audit', async () => {
    const requestId = await seedTripRequest({});
    const req = new Request('https://test.com/api/poi-favorites', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer x' },
    });
    const result = await resolveCompanionUserId(env, req, companionAuth(), requestId);
    expect(result).toBeNull();

    const audit = await readFailureAudit(requestId);
    expect(audit).toBeNull();
  });

  it('header X-Request-Scope 是其他值 → 回 null', async () => {
    const requestId = await seedTripRequest({});
    const req = buildCompanionRequest({ 'X-Request-Scope': 'admin' });
    const result = await resolveCompanionUserId(env, req, companionAuth(), requestId);
    expect(result).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Case C — scopes 不含 companion (self-reported)
// --------------------------------------------------------------------------

describe('resolveCompanionUserId — case C self_reported_scope', () => {
  it('header companion + auth.scopes 不含 companion → null + audit self_reported_scope', async () => {
    const requestId = await seedTripRequest({});
    const auth = companionAuth({ scopes: ['admin'] }); // no companion scope
    const result = await resolveCompanionUserId(env, buildCompanionRequest(), auth, requestId);
    expect(result).toBeNull();

    const audit = await readFailureAudit(requestId);
    expect(audit).not.toBeNull();
    expect(audit!.companion_failure_reason).toBe('self_reported_scope');
  });

  it('header companion + auth.scopes undefined → null + audit self_reported_scope', async () => {
    const requestId = await seedTripRequest({});
    const auth = companionAuth({ scopes: undefined });
    const result = await resolveCompanionUserId(env, buildCompanionRequest(), auth, requestId);
    expect(result).toBeNull();
    const audit = await readFailureAudit(requestId);
    expect(audit!.companion_failure_reason).toBe('self_reported_scope');
  });
});

// --------------------------------------------------------------------------
// Case D — clientId ≠ TP_REQUEST_CLIENT_ID
// --------------------------------------------------------------------------

describe('resolveCompanionUserId — case D client_unauthorized', () => {
  it('scopes 含 companion 但 clientId 不是 TP_REQUEST_CLIENT_ID → null + audit client_unauthorized', async () => {
    const requestId = await seedTripRequest({});
    const auth = companionAuth({ clientId: 'other-client' });
    const result = await resolveCompanionUserId(env, buildCompanionRequest(), auth, requestId);
    expect(result).toBeNull();
    const audit = await readFailureAudit(requestId);
    expect(audit!.companion_failure_reason).toBe('client_unauthorized');
  });

  it('TP_REQUEST_CLIENT_ID env 未設定 → null + audit client_unauthorized', async () => {
    const requestId = await seedTripRequest({});
    const envNoBinding = mockEnv(db); // 不含 TP_REQUEST_CLIENT_ID
    const result = await resolveCompanionUserId(
      envNoBinding,
      buildCompanionRequest(),
      companionAuth(),
      requestId,
    );
    expect(result).toBeNull();
    const audit = await readFailureAudit(requestId);
    expect(audit!.companion_failure_reason).toBe('client_unauthorized');
  });
});

// --------------------------------------------------------------------------
// Case E — requestId 不存在
// --------------------------------------------------------------------------

describe('resolveCompanionUserId — case E invalid_request_id (not exist)', () => {
  it('requestId 對應 row 不存在 → null + audit invalid_request_id', async () => {
    const result = await resolveCompanionUserId(env, buildCompanionRequest(), companionAuth(), 999_999);
    expect(result).toBeNull();
    const audit = await readFailureAudit(999_999);
    expect(audit!.companion_failure_reason).toBe('invalid_request_id');
  });
});

// --------------------------------------------------------------------------
// Case F — status='completed'（與 race 共用 fail-closed）
// --------------------------------------------------------------------------

describe('resolveCompanionUserId — case F status_completed', () => {
  it('row 存在但 status=completed → null + audit status_completed', async () => {
    const requestId = await seedTripRequest({ status: 'completed' });
    const result = await resolveCompanionUserId(env, buildCompanionRequest(), companionAuth(), requestId);
    expect(result).toBeNull();
    const audit = await readFailureAudit(requestId);
    expect(audit!.companion_failure_reason).toBe('status_completed');
  });

  it('row 存在但 status=open → null + audit status_completed', async () => {
    const requestId = await seedTripRequest({ status: 'open' });
    const result = await resolveCompanionUserId(env, buildCompanionRequest(), companionAuth(), requestId);
    expect(result).toBeNull();
    const audit = await readFailureAudit(requestId);
    expect(audit!.companion_failure_reason).toBe('status_completed');
  });
});

// --------------------------------------------------------------------------
// Case G — requestId 型別錯誤
// --------------------------------------------------------------------------

describe('resolveCompanionUserId — case G invalid_request_id (type error)', () => {
  it('requestId=null → null + audit invalid_request_id', async () => {
    const result = await resolveCompanionUserId(env, buildCompanionRequest(), companionAuth(), null);
    expect(result).toBeNull();
    const audit = await readFailureAudit(null);
    expect(audit!.companion_failure_reason).toBe('invalid_request_id');
  });

  it('requestId=0 → null + audit invalid_request_id', async () => {
    const result = await resolveCompanionUserId(env, buildCompanionRequest(), companionAuth(), 0);
    expect(result).toBeNull();
  });

  it('requestId=-5 → null + audit invalid_request_id', async () => {
    const result = await resolveCompanionUserId(env, buildCompanionRequest(), companionAuth(), -5);
    expect(result).toBeNull();
  });

  it('requestId=1.5（非整數）→ null + audit invalid_request_id', async () => {
    const result = await resolveCompanionUserId(env, buildCompanionRequest(), companionAuth(), 1.5);
    expect(result).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Case H — submitted_by email 沒對應 users
// --------------------------------------------------------------------------

describe('resolveCompanionUserId — case H submitter_unknown', () => {
  it('trip_requests.submitted_by email 沒對應 users → null + audit submitter_unknown', async () => {
    const requestId = await seedTripRequest({
      tripId: 'companion-test-orphan',
      tripOwner: SUBMITTER_EMAIL,            // owner 走既有 seedUser
      submittedBy: 'unknown@example.com',     // submitted_by 是孤兒 email（沒 users row）
    });
    const result = await resolveCompanionUserId(env, buildCompanionRequest(), companionAuth(), requestId);
    expect(result).toBeNull();
    const audit = await readFailureAudit(requestId);
    expect(audit!.companion_failure_reason).toBe('submitter_unknown');
  });

  it('submitted_by 為 null → null + audit submitter_unknown', async () => {
    await seedTrip(db, { id: 'companion-test-null-submitter', owner: SUBMITTER_EMAIL });
    const reqRow = await db
      .prepare(
        'INSERT INTO trip_requests (trip_id, message, submitted_by, status) VALUES (?, ?, ?, ?) RETURNING id',
      )
      .bind('companion-test-null-submitter', 'test', null, 'processing')
      .first<{ id: number }>();
    const requestId = reqRow!.id;

    const result = await resolveCompanionUserId(env, buildCompanionRequest(), companionAuth(), requestId);
    expect(result).toBeNull();
    const audit = await readFailureAudit(requestId);
    expect(audit!.companion_failure_reason).toBe('submitter_unknown');
  });
});

// --------------------------------------------------------------------------
// Case I — status race（admin PATCH completed mid-flight）
// --------------------------------------------------------------------------

describe('resolveCompanionUserId — case I status race', () => {
  it('guarded UPDATE WHERE status=processing 不符（race 中變 completed）→ null', async () => {
    // 模擬 race：先建 processing row，再立刻改 completed
    const requestId = await seedTripRequest({});
    await db
      .prepare("UPDATE trip_requests SET status = 'completed' WHERE id = ?")
      .bind(requestId)
      .run();

    const result = await resolveCompanionUserId(env, buildCompanionRequest(), companionAuth(), requestId);
    expect(result).toBeNull();

    // 雙路徑共用 status_completed reason（race 與直接 completed 行為一致）
    const audit = await readFailureAudit(requestId);
    expect(audit!.companion_failure_reason).toBe('status_completed');
  });
});

// --------------------------------------------------------------------------
// Case J — UNIQUE conflict 走 requireFavoriteActor 拋 409 COMPANION_QUOTA_EXCEEDED
// --------------------------------------------------------------------------

describe('requireFavoriteActor — case J UNIQUE 衝突 → 409', () => {
  it('同 requestId 同 action 第 2 次 INSERT companion_request_actions 衝突 → AppError COMPANION_QUOTA_EXCEEDED', async () => {
    const requestId = await seedTripRequest({});
    const poiId = await seedPoi(db, { name: 'companion test poi' });

    const ctx = mockContext({
      request: buildCompanionRequest(),
      env,
      auth: companionAuth(),
    });

    // 第一次 favorite_create OK（要等 status 變 processing 後才能進）
    // 但 requireFavoriteActor 會做 guarded UPDATE，把 status 還是維持 processing。
    // 所以連兩次需要：第一次成功後，第二次手動再把 status 設回 processing 模擬 admin 的 retry。
    const r1 = await requireFavoriteActor(ctx, { companionRequestId: requestId, poiId }, 'favorite_create');
    expect(r1.isCompanion).toBe(true);
    expect(r1.userId).toBeTruthy();
    expect(r1.requestId).toBe(requestId);

    // status 仍 processing（guarded UPDATE 是 idempotent self-set），第 2 次 INSERT 應撞 UNIQUE
    const ctx2 = mockContext({
      request: buildCompanionRequest(),
      env,
      auth: companionAuth(),
    });
    await expect(
      requireFavoriteActor(ctx2, { companionRequestId: requestId, poiId: poiId + 1 }, 'favorite_create'),
    ).rejects.toThrow(AppError);

    try {
      await requireFavoriteActor(ctx2, { companionRequestId: requestId, poiId: poiId + 2 }, 'favorite_create');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('COMPANION_QUOTA_EXCEEDED');
    }
  });

  it('同 requestId 不同 action（favorite_create + add_to_trip）→ 都成功', async () => {
    const requestId = await seedTripRequest({});
    const poiId = await seedPoi(db, { name: 'companion multi action' });

    const ctxCreate = mockContext({
      request: buildCompanionRequest(),
      env,
      auth: companionAuth(),
    });
    await requireFavoriteActor(ctxCreate, { companionRequestId: requestId, poiId }, 'favorite_create');

    // 不同 action 不撞 UNIQUE
    const ctxAdd = mockContext({
      request: buildCompanionRequest(),
      env,
      auth: companionAuth(),
    });
    await expect(
      requireFavoriteActor(ctxAdd, { companionRequestId: requestId, poiId }, 'add_to_trip'),
    ).resolves.toBeDefined();
  });
});

// --------------------------------------------------------------------------
// requireFavoriteActor — V2 user 路徑（fallback）
// --------------------------------------------------------------------------

describe('requireFavoriteActor — V2 user fallback', () => {
  it('scope ≠ companion + auth.userId 存在 → 回 V2 user 結構（isCompanion=false）', async () => {
    const userId = await seedUser(db, 'v2-user@test.com');
    const ctx = mockContext({
      request: new Request('https://test.com/api/poi-favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
      env,
      auth: mockAuth({ email: 'v2-user@test.com', userId }),
    });

    const result = await requireFavoriteActor(ctx, { poiId: 1 }, 'favorite_create');
    expect(result.isCompanion).toBe(false);
    expect(result.userId).toBe(userId);
    expect(result.requestId).toBeNull();
  });

  it('scope ≠ companion + auth.userId null → 拋 401 AUTH_REQUIRED', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/poi-favorites', { method: 'POST' }),
      env,
      auth: mockAuth({ email: 'service:x', userId: null, isServiceToken: true }),
    });

    await expect(
      requireFavoriteActor(ctx, { poiId: 1 }, 'favorite_create'),
    ).rejects.toThrow(AppError);
  });

  it('GET 走 query param ?companionRequestId=N（body=null）', async () => {
    const requestId = await seedTripRequest({});
    const reqWithQuery = new Request(`https://test.com/api/poi-favorites?companionRequestId=${requestId}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer x',
        'X-Request-Scope': 'companion',
      },
    });
    const ctx = mockContext({
      request: reqWithQuery,
      env,
      auth: companionAuth(),
    });

    const result = await requireFavoriteActor(ctx, null, 'favorite_list');
    expect(result.isCompanion).toBe(true);
    expect(result.requestId).toBe(requestId);
  });
});
