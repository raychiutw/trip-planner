/**
 * Integration test — GET /api/my-trips
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, seedTrip , callHandler } from './helpers';
import { onRequestGet } from '../../functions/api/my-trips';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-my-1', owner: 'me@test.com' });
  await seedTrip(db, { id: 'trip-my-2', owner: 'me@test.com' });
  await seedTrip(db, { id: 'trip-other', owner: 'other@test.com' });
});

afterAll(disposeMiniflare);

describe('GET /api/my-trips', () => {
  it('member 看到自己的行程', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/my-trips'),
      env,
      auth: mockAuth({ email: 'me@test.com' }),
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<Record<string, unknown>>;
    expect(data.length).toBe(2);
    expect(data.every(t => t.tripId === 'trip-my-1' || t.tripId === 'trip-my-2')).toBe(true);
  });

  it('非 owner 不再看到所有行程（Phase 3：無全域 admin bypass）', async () => {
    // 舊行為：admin email 走 see-all 分支看到全部行程。
    // Phase 3 移除 admin bypass 後，任何無 trip_permissions row 的 user 看到 0 筆。
    const ctx = mockContext({
      request: new Request('https://test.com/api/my-trips'),
      env,
      auth: mockAuth({ email: 'admin@test.com' }),
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<Record<string, unknown>>;
    expect(data.length).toBe(0);
  });

  it('受限 token（restrict_trip）只看自己那個 trip，不列舉 owner 其他 trip（v2.55.56 confused-deputy 偵察面）', async () => {
    // me@test.com 擁有 trip-my-1 + trip-my-2，但受限到 trip-my-1 的 token 只該看到 trip-my-1。
    const ctx = mockContext({
      request: new Request('https://test.com/api/my-trips'),
      env,
      auth: mockAuth({ email: 'me@test.com', restrictTrip: 'trip-my-1' }),
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<Record<string, unknown>>;
    expect(data.length).toBe(1);
    expect(data[0].tripId).toBe('trip-my-1');
  });

  it('未認證 → handler crash（middleware 已在前攔截）', async () => {
    // my-trips handler 假設 middleware 已驗證 auth，不做 null check
    // 實際上 middleware 會先回 401，handler 不會被呼叫
    const ctx = mockContext({
      request: new Request('https://test.com/api/my-trips'),
      env,
    });
    await expect(onRequestGet(ctx)).rejects.toThrow();
  });
});
