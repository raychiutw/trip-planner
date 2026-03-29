/**
 * Integration test — GET/POST /api/permissions + DELETE /api/permissions/:id
 * 注意：POST/DELETE 會呼叫 Cloudflare Access API，這裡只測 D1 邏輯
 * （Access API 呼叫會因無效 token 而失敗，但 D1 邏輯部分可驗證）
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip } from './helpers';
import { onRequestGet } from '../../functions/api/permissions';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-perm', owner: 'admin@test.com' });
});

afterAll(disposeMiniflare);

describe('GET /api/permissions', () => {
  it('admin 列出權限', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/permissions?tripId=trip-perm'),
      env,
      auth: mockAuth({ email: 'admin@test.com', isAdmin: true }),
    });
    const resp = await onRequestGet(ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it('非 admin → 403', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/permissions?tripId=trip-perm'),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
    });
    expect((await onRequestGet(ctx)).status).toBe(403);
  });

  it('未認證 → handler crash（middleware 已在前攔截）', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/permissions?tripId=trip-perm'),
      env,
    });
    await expect(onRequestGet(ctx)).rejects.toThrow();
  });
});
