/**
 * Integration test — GET /api/my-trips
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, seedTrip } from './helpers';
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
    const resp = await onRequestGet(ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<Record<string, unknown>>;
    expect(data.length).toBe(2);
    expect(data.every(t => t.tripId === 'trip-my-1' || t.tripId === 'trip-my-2')).toBe(true);
  });

  it('admin 看到所有行程', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/my-trips'),
      env,
      auth: mockAuth({ email: 'admin@test.com', isAdmin: true }),
    });
    const resp = await onRequestGet(ctx);
    const data = await resp.json() as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThanOrEqual(3);
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
