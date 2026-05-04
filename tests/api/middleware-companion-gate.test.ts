/**
 * Middleware companion gate (poi-favorites-rename §5.1)
 *
 * 端對端驗證：V2 Bearer token → middleware attaches auth.scopes / auth.clientId
 * → resolveCompanionUserId 正確套三 gate（X-Request-Scope header + scopes 含
 * 'companion' + clientId === env.TP_REQUEST_CLIENT_ID）。
 *
 *   case (a) 三條件全符合 → companion mapping 啟用（resolver 回 userId）
 *   case (b) 缺 scope（OAuth scopes 不含 companion）→ self_reported_scope
 *   case (c) 缺 clientId（mismatch）→ client_unauthorized
 *   case (d) 缺 header（X-Request-Scope）→ V2 user 路徑（resolver 回 null，不寫 audit）
 *
 * 與 companion-resolver.test.ts 的差異：本檔走真實 OAuth AccessToken row +
 * 真實 middleware.onRequest，確認 middleware → helper 的橋接無斷裂。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, seedUser, seedTrip } from './helpers';
import { onRequest } from '../../functions/api/_middleware';
import { resolveCompanionUserId } from '../../functions/api/_companion';
import { D1Adapter } from '../../src/server/oauth-d1-adapter';
import type { Env, AuthData } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

const TP_REQUEST_CLIENT_ID = 'tripline-internal-cli';
const SUBMITTER_EMAIL = 'companion-gate-submitter@test.com';

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db, { TP_REQUEST_CLIENT_ID });
  await seedUser(db, SUBMITTER_EMAIL);
});

afterAll(disposeMiniflare);

beforeEach(async () => {
  await db.prepare("DELETE FROM oauth_models WHERE name = 'AccessToken'").run();
  await db.prepare("DELETE FROM audit_log WHERE trip_id = 'system:companion'").run();
  await db.prepare("DELETE FROM trip_requests WHERE trip_id LIKE 'companion-gate-%'").run();
});

async function insertAccessToken(opts: {
  token: string;
  clientId: string;
  scopes: string[];
  userId?: string | null;
}): Promise<void> {
  const adapter = new D1Adapter(db, 'AccessToken');
  await adapter.upsert(
    opts.token,
    {
      jti: opts.token,
      client_id: opts.clientId,
      user_id: opts.userId ?? null,
      scopes: opts.scopes,
      grantId: `grant-${opts.token}`,
    },
    300,
  );
}

async function seedRequest(): Promise<number> {
  const tripId = 'companion-gate-trip-1';
  await seedTrip(db, { id: tripId, owner: SUBMITTER_EMAIL });
  const row = await db
    .prepare(
      'INSERT INTO trip_requests (trip_id, message, submitted_by, status) VALUES (?, ?, ?, ?) RETURNING id',
    )
    .bind(tripId, 'gate test', SUBMITTER_EMAIL, 'processing')
    .first<{ id: number }>();
  return row!.id;
}

/**
 * 跑一遍 middleware，回傳 middleware 寫入 context.data.auth 的值。
 * stubbed next 會 short-circuit 真正的 handler，只測 middleware 階段附 auth。
 */
async function runMiddleware(opts: {
  request: Request;
}): Promise<{ auth: AuthData | null; response: Response }> {
  const data: Record<string, unknown> = {};
  const ctx = {
    request: opts.request,
    env,
    params: {},
    data,
    next: () => Promise.resolve(new Response('next', { status: 200 })),
    waitUntil: (_p: Promise<unknown>) => undefined,
    passThroughOnException: () => undefined,
    functionPath: '',
  } as unknown as Parameters<typeof onRequest>[0];

  const response = await onRequest(ctx);
  return { auth: (data.auth ?? null) as AuthData | null, response };
}

describe('middleware companion gate (§5.1)', () => {
  it('case (a) Bearer companion scope + 對的 clientId + 對的 header → 三 gate 全過 / resolver 回 userId', async () => {
    const token = 'token-companion-ok';
    await insertAccessToken({
      token,
      clientId: TP_REQUEST_CLIENT_ID,
      scopes: ['admin', 'companion'],
      userId: null,
    });
    const requestId = await seedRequest();

    const req = new Request('https://test.com/api/poi-favorites', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Request-Scope': 'companion',
        Origin: 'https://trip-planner-dby.pages.dev',
      },
    });
    const { auth } = await runMiddleware({ request: req });

    // middleware 應 attach scopes / clientId
    expect(auth).not.toBeNull();
    expect(auth!.scopes).toContain('companion');
    expect(auth!.clientId).toBe(TP_REQUEST_CLIENT_ID);
    expect(auth!.isServiceToken).toBe(true);

    // 真正餵進 resolver 看是否 gate 全過
    const result = await resolveCompanionUserId(env, req, auth, requestId);
    expect(result).not.toBeNull();
    expect(result!.requestId).toBe(requestId);
    expect(result!.userId).toBeTruthy();
  });

  it('case (b) Bearer 不含 companion scope → resolver 回 null + audit self_reported_scope', async () => {
    const token = 'token-admin-only';
    await insertAccessToken({
      token,
      clientId: TP_REQUEST_CLIENT_ID,
      scopes: ['admin'], // 缺 companion
      userId: null,
    });
    const requestId = await seedRequest();

    const req = new Request('https://test.com/api/poi-favorites', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Request-Scope': 'companion',
        Origin: 'https://trip-planner-dby.pages.dev',
      },
    });
    const { auth } = await runMiddleware({ request: req });
    expect(auth!.scopes).not.toContain('companion');

    const result = await resolveCompanionUserId(env, req, auth, requestId);
    expect(result).toBeNull();

    const audit = await db
      .prepare(
        `SELECT companion_failure_reason FROM audit_log
         WHERE trip_id = 'system:companion' AND request_id = ? ORDER BY id DESC LIMIT 1`,
      )
      .bind(requestId)
      .first<{ companion_failure_reason: string }>();
    expect(audit!.companion_failure_reason).toBe('self_reported_scope');
  });

  it('case (c) Bearer 含 companion scope 但 clientId 不對 → resolver 回 null + audit client_unauthorized', async () => {
    const token = 'token-wrong-client';
    await insertAccessToken({
      token,
      clientId: 'rogue-cli',
      scopes: ['admin', 'companion'],
      userId: null,
    });
    const requestId = await seedRequest();

    const req = new Request('https://test.com/api/poi-favorites', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Request-Scope': 'companion',
        Origin: 'https://trip-planner-dby.pages.dev',
      },
    });
    const { auth } = await runMiddleware({ request: req });
    expect(auth!.scopes).toContain('companion');
    expect(auth!.clientId).toBe('rogue-cli');

    const result = await resolveCompanionUserId(env, req, auth, requestId);
    expect(result).toBeNull();

    const audit = await db
      .prepare(
        `SELECT companion_failure_reason FROM audit_log
         WHERE trip_id = 'system:companion' AND request_id = ? ORDER BY id DESC LIMIT 1`,
      )
      .bind(requestId)
      .first<{ companion_failure_reason: string }>();
    expect(audit!.companion_failure_reason).toBe('client_unauthorized');
  });

  it('case (d) 缺 X-Request-Scope header → resolver 回 null（V2 user 路徑，不寫 audit）', async () => {
    const token = 'token-no-header';
    await insertAccessToken({
      token,
      clientId: TP_REQUEST_CLIENT_ID,
      scopes: ['admin', 'companion'],
      userId: null,
    });
    const requestId = await seedRequest();

    const req = new Request('https://test.com/api/poi-favorites', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // 故意不放 X-Request-Scope
        Origin: 'https://trip-planner-dby.pages.dev',
      },
    });
    const { auth } = await runMiddleware({ request: req });
    expect(auth!.scopes).toContain('companion');

    const result = await resolveCompanionUserId(env, req, auth, requestId);
    expect(result).toBeNull();

    const audit = await db
      .prepare(
        `SELECT id FROM audit_log
         WHERE trip_id = 'system:companion' AND request_id = ?`,
      )
      .bind(requestId)
      .first();
    expect(audit).toBeNull();
  });
});
