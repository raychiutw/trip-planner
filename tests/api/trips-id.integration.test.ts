/**
 * Integration test — GET/PUT /api/trips/:id
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip } from './helpers';
import { onRequestGet, onRequestPut } from '../../functions/api/trips/[id]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-1', owner: 'user@test.com' });
});

afterAll(disposeMiniflare);

describe('GET /api/trips/:id', () => {
  it('取得行程 meta', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-1'),
      env,
      params: { id: 'trip-1' },
    });
    const resp = await onRequestGet(ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Record<string, unknown>;
    expect(data.tripId).toBe('trip-1');
  });

  it('不存在 → 404', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/nope'),
      env,
      params: { id: 'nope' },
    });
    expect((await onRequestGet(ctx)).status).toBe(404);
  });
});

describe('PUT /api/trips/:id', () => {
  it('更新行程 → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-1', 'PUT', { title: '新標題' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-1' },
    });
    const resp = await onRequestPut(ctx);
    expect(resp.status).toBe(200);
    const trip = await db.prepare('SELECT title FROM trips WHERE id = ?').bind('trip-1').first();
    expect((trip as Record<string, unknown>).title).toBe('新標題');
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-1', 'PUT', { title: 'x' }),
      env,
      params: { id: 'trip-1' },
    });
    expect((await onRequestPut(ctx)).status).toBe(401);
  });

  it('無權限 → 403', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-1', 'PUT', { title: 'x' }),
      env,
      auth: mockAuth({ email: 'stranger@test.com' }),
      params: { id: 'trip-1' },
    });
    expect((await onRequestPut(ctx)).status).toBe(403);
  });
});
