/**
 * Integration test — POST /api/poi-favorites (poi-favorites-rename §6)
 *
 * Cover：
 *   §6.1 V2 user 成功 / 400 缺 poiId / 404 POI 不存在 / 409 重複收藏 / 429 rate limit / admin bypass
 *   §6.2 companion 三 gate 全過 → 201 + audit_log + companion_request_actions 1 row
 *   §6.3 companion 同 requestId POST 第 2 次 → 409 COMPANION_QUOTA_EXCEEDED
 *   §6.4 service token 無 companion gate → V2 user fallback 401
 *   §6.5 SQL injection on note → INSERT 成功（D1 prepared statement 防護）+ pois 表不被 drop
 *   §6.6 UTF-8 garbled note → middleware 層擋（_validate.ts），handler 不直接覆蓋
 *   §6.7 100 burst concurrent companion POST → mix 201 / 409 / 429
 *   §6.8 self-reported X-Request-Scope without OAuth scope → V2 user fallback 401
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import {
  mockEnv,
  mockAuth,
  mockContext,
  jsonRequest,
  seedPoi,
  seedUser,
  seedTrip,
  userIdFor,
  callHandler,
} from './helpers';
import { onRequestPost } from '../../functions/api/poi-favorites';
import type { AuthData, Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
let poiBase: number;

const TP_REQUEST_CLIENT_ID = 'tripline-internal-cli';
const SUBMITTER_EMAIL = 'companion-post@test.com';

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db, { TP_REQUEST_CLIENT_ID });
  poiBase = await seedPoi(db, { name: 'POI base for poi-favorites-post' });
  await seedUser(db, SUBMITTER_EMAIL);
});

afterAll(disposeMiniflare);

beforeEach(async () => {
  await db.prepare("DELETE FROM companion_request_actions").run();
  await db.prepare("DELETE FROM audit_log WHERE trip_id = 'system:companion'").run();
  await db.prepare("DELETE FROM trip_requests WHERE trip_id LIKE 'companion-post-%'").run();
  await db.prepare("DELETE FROM poi_favorites WHERE user_id LIKE 'test-user-%'").run();
  await db
    .prepare("DELETE FROM rate_limit_buckets WHERE bucket_key LIKE 'poi-favorites-post:%'")
    .run();
});

// ----- helpers -----

function v2Auth(overrides: Partial<AuthData> = {}): AuthData {
  return mockAuth({ email: 'v2-user@test.com', ...overrides });
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

function buildPostRequest(body: Record<string, unknown>, headers: Record<string, string> = {}): Request {
  return new Request('https://test.com/api/poi-favorites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function seedTripRequest(opts: {
  status?: 'open' | 'processing' | 'completed' | 'failed';
  submittedBy?: string;
} = {}): Promise<number> {
  const tripId = `companion-post-trip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await seedTrip(db, { id: tripId, owner: SUBMITTER_EMAIL });
  const row = await db
    .prepare(
      'INSERT INTO trip_requests (trip_id, message, submitted_by, status) VALUES (?, ?, ?, ?) RETURNING id',
    )
    .bind(tripId, 'post test', opts.submittedBy ?? SUBMITTER_EMAIL, opts.status ?? 'processing')
    .first<{ id: number }>();
  return row!.id;
}

// ----- §6.1 V2 user 成功 / 失敗 -----

describe('POST /api/poi-favorites — §6.1 V2 user', () => {
  it('成功 INSERT 回 201 + RETURNING row', async () => {
    const ctx = mockContext({
      request: buildPostRequest({ poiId: poiBase, note: 'V2 user happy path' }),
      env,
      auth: v2Auth({ email: 'v2-happy@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);
    // json() helper 套 deepCamel：DB 的 user_id / poi_id → camelCase
    const row = await resp.json() as { id: number; userId: string; poiId: number; note: string };
    expect(row.id).toBeGreaterThan(0);
    expect(row.userId).toBe(userIdFor('v2-happy@test.com'));
    expect(row.poiId).toBe(poiBase);
    expect(row.note).toBe('V2 user happy path');
  });

  it('缺 poiId → 400', async () => {
    const ctx = mockContext({
      request: buildPostRequest({ note: 'no poi' }),
      env,
      auth: v2Auth({ email: 'v2-400-missing@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
  });

  it('poiId=0 → 400', async () => {
    const ctx = mockContext({
      request: buildPostRequest({ poiId: 0 }),
      env,
      auth: v2Auth({ email: 'v2-400-zero@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
  });

  it('poiId 負數 → 400', async () => {
    const ctx = mockContext({
      request: buildPostRequest({ poiId: -1 }),
      env,
      auth: v2Auth({ email: 'v2-400-neg@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
  });

  it('POI 不存在 → 404', async () => {
    const ctx = mockContext({
      request: buildPostRequest({ poiId: 999_999 }),
      env,
      auth: v2Auth({ email: 'v2-404@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(404);
  });

  it('重複收藏 → 409', async () => {
    const userId = await seedUser(db, 'v2-409@test.com');
    await db
      .prepare('INSERT INTO poi_favorites (user_id, poi_id) VALUES (?, ?)')
      .bind(userId, poiBase)
      .run();

    const ctx = mockContext({
      request: buildPostRequest({ poiId: poiBase }),
      env,
      auth: v2Auth({ email: 'v2-409@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(409);
  });

  it('11 次連續 POST 中第 11 次 → 429 + Retry-After', async () => {
    // 11 個不同 poiId 避免 409
    const poiIds: number[] = [];
    for (let i = 0; i < 11; i++) {
      poiIds.push(await seedPoi(db, { name: `RL POI ${i}` }));
    }

    const results: number[] = [];
    for (let i = 0; i < 11; i++) {
      const ctx = mockContext({
        request: buildPostRequest({ poiId: poiIds[i] }),
        env,
        auth: v2Auth({ email: 'v2-429@test.com' }),
      });
      const resp = await callHandler(onRequestPost, ctx);
      results.push(resp.status);
      if (i === 10) {
        expect(resp.status).toBe(429);
        expect(resp.headers.get('Retry-After')).toBeTruthy();
      }
    }
    expect(results.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(results[10]).toBe(429);
  });

  it('admin bypass rate limit', async () => {
    const poiIds: number[] = [];
    for (let i = 0; i < 11; i++) {
      poiIds.push(await seedPoi(db, { name: `Admin POI ${i}` }));
    }
    for (let i = 0; i < 11; i++) {
      const ctx = mockContext({
        request: buildPostRequest({ poiId: poiIds[i] }),
        env,
        auth: v2Auth({ email: 'v2-admin@test.com', isAdmin: true }),
      });
      const resp = await callHandler(onRequestPost, ctx);
      // 不可有 429（admin bypass）
      expect([201, 409]).toContain(resp.status);
    }
  });
});

// ----- §6.2 companion 成功 -----

describe('POST /api/poi-favorites — §6.2 companion happy path', () => {
  it('valid companion 三 gate + companionRequestId → 201 + audit_log + companion_request_actions', async () => {
    const requestId = await seedTripRequest({});
    const ctx = mockContext({
      request: buildPostRequest(
        { companionRequestId: requestId, poiId: poiBase, note: 'companion add' },
        { 'X-Request-Scope': 'companion' },
      ),
      env,
      auth: companionAuth(),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);
    const row = await resp.json() as { id: number; userId: string; poiId: number };
    expect(row.id).toBeGreaterThan(0);
    expect(row.poiId).toBe(poiBase);

    // user_id 應對映 trip_requests.submitted_by → users.id
    const expected = await db
      .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)')
      .bind(SUBMITTER_EMAIL)
      .first<{ id: string }>();
    expect(row.userId).toBe(expected!.id);

    // companion_request_actions 1 row（直查 D1 — 不過 json() camelCase 轉換）
    const actions = await db
      .prepare('SELECT action, poi_id FROM companion_request_actions WHERE request_id = ?')
      .bind(requestId)
      .all<{ action: string; poi_id: number | null }>();
    expect(actions.results).toHaveLength(1);
    expect(actions.results[0]!.action).toBe('favorite_create');
    expect(actions.results[0]!.poi_id).toBe(poiBase);

    // audit_log 多 1 row
    const audit = await db
      .prepare(
        `SELECT changed_by, trip_id, action, record_id, request_id FROM audit_log
         WHERE record_id = ? AND table_name = 'poi_favorites' ORDER BY id DESC LIMIT 1`,
      )
      .bind(row.id)
      .first<{ changed_by: string; trip_id: string; action: string; record_id: number; request_id: number }>();
    expect(audit).not.toBeNull();
    expect(audit!.changed_by).toBe(`companion:${requestId}`);
    expect(audit!.trip_id).toBe('system:companion');
    expect(audit!.action).toBe('insert');
    expect(audit!.request_id).toBe(requestId);
  });
});

// ----- §6.3 companion quota -----

describe('POST /api/poi-favorites — §6.3 companion quota', () => {
  it('同 requestId 同 action 第 2 次（不同 poiId）→ 409 COMPANION_QUOTA_EXCEEDED', async () => {
    const requestId = await seedTripRequest({});
    const poi2 = await seedPoi(db, { name: 'companion second poi' });

    // 第 1 次 favorite_create — 應成功
    const ctx1 = mockContext({
      request: buildPostRequest(
        { companionRequestId: requestId, poiId: poiBase },
        { 'X-Request-Scope': 'companion' },
      ),
      env,
      auth: companionAuth(),
    });
    const r1 = await callHandler(onRequestPost, ctx1);
    expect(r1.status).toBe(201);

    // 第 2 次（不同 poi）→ companion_request_actions UNIQUE → 409 COMPANION_QUOTA_EXCEEDED
    const ctx2 = mockContext({
      request: buildPostRequest(
        { companionRequestId: requestId, poiId: poi2 },
        { 'X-Request-Scope': 'companion' },
      ),
      env,
      auth: companionAuth(),
    });
    const r2 = await callHandler(onRequestPost, ctx2);
    expect(r2.status).toBe(409);
    const json = await r2.json() as { error: { code: string } };
    expect(json.error.code).toBe('COMPANION_QUOTA_EXCEEDED');
  });
});

// ----- §6.4 service token 無 companion gate → 401 -----

describe('POST /api/poi-favorites — §6.4 service token without companion gate', () => {
  it('service token 缺 companion scope → fail-closed 401', async () => {
    const requestId = await seedTripRequest({});
    const ctx = mockContext({
      request: buildPostRequest(
        { companionRequestId: requestId, poiId: poiBase },
        { 'X-Request-Scope': 'companion' },
      ),
      env,
      auth: companionAuth({ scopes: ['admin'] }), // 缺 companion
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(401);
  });

  it('service token clientId 不對 → fail-closed 401', async () => {
    const requestId = await seedTripRequest({});
    const ctx = mockContext({
      request: buildPostRequest(
        { companionRequestId: requestId, poiId: poiBase },
        { 'X-Request-Scope': 'companion' },
      ),
      env,
      auth: companionAuth({ clientId: 'rogue-cli' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(401);
  });
});

// ----- §6.5 SQL injection 防護 -----

describe('POST /api/poi-favorites — §6.5 SQL injection on note', () => {
  it('note 含 SQL injection payload → INSERT 成功（D1 prepared statement 防護）+ pois 表不變', async () => {
    const evilNote = "x'; DROP TABLE pois; --";
    const ctx = mockContext({
      request: buildPostRequest({ poiId: poiBase, note: evilNote }),
      env,
      auth: v2Auth({ email: 'v2-sqli@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);

    const row = await resp.json() as { note: string };
    expect(row.note).toBe(evilNote);  // prepared statement 把 ' 當 literal，不執行

    // pois table 應仍存在（schema 沒被 drop）
    const poisCount = await db
      .prepare('SELECT COUNT(*) AS c FROM pois')
      .first<{ c: number }>();
    expect(poisCount!.c).toBeGreaterThan(0);
  });
});

// ----- §6.7 burst concurrent → mix 201 / 409 / 429 -----

describe('POST /api/poi-favorites — §6.7 burst concurrent companion', () => {
  it('100 burst concurrent 同 requestId → companion 雙重防護（UNIQUE 409 + bucket 429）', async () => {
    const requestId = await seedTripRequest({});
    // 100 個不同 poiId（避免 V2 user UNIQUE 撞）
    const poiIds: number[] = [];
    for (let i = 0; i < 100; i++) {
      poiIds.push(await seedPoi(db, { name: `Burst POI ${i}` }));
    }

    const promises: Promise<Response>[] = [];
    for (let i = 0; i < 100; i++) {
      const ctx = mockContext({
        request: buildPostRequest(
          { companionRequestId: requestId, poiId: poiIds[i] },
          { 'X-Request-Scope': 'companion' },
        ),
        env,
        auth: companionAuth(),
      });
      promises.push(callHandler(onRequestPost, ctx));
    }

    const responses = await Promise.all(promises);
    const statuses = responses.map((r) => r.status);
    const counts = statuses.reduce<Record<number, number>>(
      (acc, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }),
      {},
    );

    // 預期：1 × 201（首次成功）+ 9 × 409（rate limit 內部 UNIQUE）+ 90 × 429（bucket lock）
    expect(counts[201] ?? 0).toBeGreaterThanOrEqual(1);
    expect(counts[429] ?? 0).toBeGreaterThanOrEqual(1);
    // 不應全部 201（會破壞 quota 防護）
    expect(counts[201] ?? 0).toBeLessThan(10);
  });
});

// ----- §6.8 self-reported header without OAuth scope -----

describe('POST /api/poi-favorites — §6.8 self-reported header without OAuth scope', () => {
  it('header companion + auth 無 companion scope → fail-closed 401（V2 user fallback userId null）', async () => {
    const requestId = await seedTripRequest({});
    const ctx = mockContext({
      request: buildPostRequest(
        { companionRequestId: requestId, poiId: poiBase },
        { 'X-Request-Scope': 'companion' },
      ),
      env,
      auth: companionAuth({ scopes: ['admin'] }), // self-reported header without OAuth gate
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(401);

    // server 端 audit_log 應寫 self_reported_scope
    const audit = await db
      .prepare(
        `SELECT companion_failure_reason FROM audit_log
         WHERE trip_id = 'system:companion' AND request_id = ? ORDER BY id DESC LIMIT 1`,
      )
      .bind(requestId)
      .first<{ companion_failure_reason: string }>();
    expect(audit!.companion_failure_reason).toBe('self_reported_scope');
  });
});
