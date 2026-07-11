/**
 * Integration test — POST /api/oauth/downscope THROUGH the real middleware (v2.55.56)
 *
 * 這支是唯一走「真 _middleware.onRequest → 真 handler」的 downscope 測試 —
 * 抓的是 unit/mock 測試結構上抓不到的 bug：/api/oauth/* 被 middleware 全 auth-null
 * 短路，downscope 靠 requireAuth 讀 context.data.auth，若沒把它從短路排除 → 端點
 * 永遠 401、整個 user-token 寫入路徑在 prod 是死的。
 *
 * 同時端對端驗 confused-deputy 強制：受限（restrict_trip）token 換發/讀寫別 trip → 擋。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, seedTrip } from './helpers';
import { onRequest } from '../../functions/api/_middleware';
import { onRequestPost as downscopePost } from '../../functions/api/oauth/downscope';
import { onRequestGet as tripGet } from '../../functions/api/trips/[id]';
import { D1Adapter } from '../../src/server/oauth-d1-adapter';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
let ownerUserId: string;

const OWNER_EMAIL = 'downscope-owner@test.com';

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  // owner 擁有 trip-A 與 trip-B（模擬 A-Ray：同一 owner 多 trip）
  const a = await seedTrip(db, { id: 'ds-trip-a', owner: OWNER_EMAIL });
  await seedTrip(db, { id: 'ds-trip-b', owner: OWNER_EMAIL });
  ownerUserId = a.ownerUserId;
});

afterAll(disposeMiniflare);

beforeEach(async () => {
  await db.prepare("DELETE FROM oauth_models WHERE name = 'AccessToken'").run();
});

async function seedAccessToken(opts: {
  token: string;
  userId: string | null;
  restrictTrip?: string;
}): Promise<void> {
  await new D1Adapter(db, 'AccessToken').upsert(
    opts.token,
    {
      jti: opts.token,
      client_id: 'tripline-tp-request',
      user_id: opts.userId,
      scopes: ['openid', 'profile'],
      grantId: `grant-${opts.token}`,
      ...(opts.restrictTrip ? { restrict_trip: opts.restrictTrip } : {}),
    },
    300,
  );
}

/** 跑 middleware.onRequest，next() 接到指定 handler（共用 context.data，讓 handler 讀得到
 *  middleware attach 的 auth）。回傳最終 Response。 */
async function throughMiddleware(request: Request, handler: (ctx: any) => Promise<Response>): Promise<Response> {
  const data: Record<string, unknown> = {};
  const base = { request, env, params: {}, data, waitUntil: () => undefined, passThroughOnException: () => undefined, functionPath: '' };
  const ctx = {
    ...base,
    next: () => handler({ ...base }),
  } as unknown as Parameters<typeof onRequest>[0];
  return onRequest(ctx);
}

describe('POST /api/oauth/downscope through real middleware', () => {
  it('valid user Bearer → 200 + restrict_trip（證明 middleware 有解析 Bearer，未被 oauth-null 短路吃掉）', async () => {
    const token = 'ds-user-token-ok';
    await seedAccessToken({ token, userId: ownerUserId });

    const req = new Request('https://test.com/api/oauth/downscope', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ trip_id: 'ds-trip-a' }),
    });
    const res = await throughMiddleware(req, downscopePost);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.restrict_trip).toBe('ds-trip-a');
    expect(typeof body.access_token).toBe('string');
    expect(body.token_type).toBe('Bearer');

    // 換發的 token row 確實帶 restrict_trip
    const minted = await new D1Adapter(db, 'AccessToken').find(body.access_token as string);
    expect(minted?.restrict_trip).toBe('ds-trip-a');
    expect(minted?.user_id).toBe(ownerUserId);
  });

  it('無 Bearer → 401 AUTH_REQUIRED（middleware 攔）', async () => {
    const req = new Request('https://test.com/api/oauth/downscope', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ trip_id: 'ds-trip-a' }),
    });
    const res = await throughMiddleware(req, downscopePost);
    expect(res.status).toBe(401);
  });

  it('對無寫權的 trip downscope → 403（server 端 re-verify，不信 caller）', async () => {
    const token = 'ds-user-token-noperm';
    // 另一個 user，對 ds-trip-a 無權
    await seedAccessToken({ token, userId: 'test-user-outsider' });
    const req = new Request('https://test.com/api/oauth/downscope', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ trip_id: 'ds-trip-a' }),
    });
    const res = await throughMiddleware(req, downscopePost);
    expect(res.status).toBe(403);
  });

  it('已受限 token 再 downscope → 403（防外洩受限 token 自我提權）', async () => {
    const token = 'ds-already-restricted';
    await seedAccessToken({ token, userId: ownerUserId, restrictTrip: 'ds-trip-a' });
    const req = new Request('https://test.com/api/oauth/downscope', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ trip_id: 'ds-trip-b' }),
    });
    const res = await throughMiddleware(req, downscopePost);
    expect(res.status).toBe(403);
  });
});

describe('restrict_trip 跨 trip 強制（end-to-end through middleware）', () => {
  it('restrict_trip=ds-trip-a 的 token 讀 ds-trip-b → 403（confused-deputy：連讀都擋）', async () => {
    const token = 'ds-restricted-to-a';
    await seedAccessToken({ token, userId: ownerUserId, restrictTrip: 'ds-trip-a' });
    const req = new Request('https://test.com/api/trips/ds-trip-b', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await throughMiddleware(req, (ctx) => tripGet({ ...ctx, params: { id: 'ds-trip-b' } }));
    expect(res.status).toBe(403);
  });

  it('restrict_trip=ds-trip-a 的 token 讀 ds-trip-a → 200（自己那個 trip 正常）', async () => {
    const token = 'ds-restricted-to-a-2';
    await seedAccessToken({ token, userId: ownerUserId, restrictTrip: 'ds-trip-a' });
    const req = new Request('https://test.com/api/trips/ds-trip-a', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await throughMiddleware(req, (ctx) => tripGet({ ...ctx, params: { id: 'ds-trip-a' } }));
    expect(res.status).toBe(200);
  });
});
