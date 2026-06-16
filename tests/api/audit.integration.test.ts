/**
 * Integration test — GET /api/trips/:id/audit
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, seedTrip , callHandler } from './helpers';
import { onRequestGet } from '../../functions/api/trips/[id]/audit';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-audit' });
  // 插入 audit log
  await db.prepare(
    'INSERT INTO audit_log (trip_id, table_name, record_id, action, changed_by, diff_json) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind('trip-audit', 'trips', 1, 'update', 'admin@test.com', '{"title":{"old":"a","new":"b"}}').run();
});

afterAll(disposeMiniflare);

describe('GET /api/trips/:id/audit', () => {
  it('owner 取得 audit log', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-audit/audit'),
      env,
      auth: mockAuth({ email: 'user@test.com' }), // trip-audit owner（D4：audit 改 owner gate）
      params: { id: 'trip-audit' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0].action).toBe('update');
  });

  it('非 owner（無 trip 寫權限）→ 403', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-audit/audit'),
      env,
      auth: mockAuth({ email: 'stranger@test.com' }),
      params: { id: 'trip-audit' },
    });
    expect((await callHandler(onRequestGet, ctx)).status).toBe(403);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-audit/audit'),
      env,
      params: { id: 'trip-audit' },
    });
    expect((await callHandler(onRequestGet, ctx)).status).toBe(401);
  });
});
