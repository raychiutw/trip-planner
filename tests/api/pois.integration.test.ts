/**
 * Integration test — PATCH /api/pois/:id (admin only)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedPoi } from './helpers';
import { onRequestPatch } from '../../functions/api/pois/[id]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
let poiId: number;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  poiId = await seedPoi(db, { type: 'hotel', name: 'Test Hotel' });
});

afterAll(disposeMiniflare);

describe('PATCH /api/pois/:id', () => {
  it('admin 更新 POI → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}`, 'PATCH', {
        google_rating: 4.5,
        address: '沖繩縣那霸市',
      }),
      env,
      auth: mockAuth({ email: 'admin@test.com', isAdmin: true }),
      params: { id: String(poiId) },
    });
    const resp = await onRequestPatch(ctx);
    expect(resp.status).toBe(200);
    const poi = await db.prepare('SELECT google_rating, address FROM pois WHERE id = ?').bind(poiId).first();
    expect((poi as Record<string, unknown>).google_rating).toBe(4.5);
    expect((poi as Record<string, unknown>).address).toBe('沖繩縣那霸市');
  });

  it('非 admin → 403', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}`, 'PATCH', { name: 'x' }),
      env,
      auth: mockAuth({ email: 'user@test.com', isAdmin: false }),
      params: { id: String(poiId) },
    });
    expect((await onRequestPatch(ctx)).status).toBe(403);
  });

  it('不存在 → 404', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/pois/99999', 'PATCH', { name: 'x' }),
      env,
      auth: mockAuth({ email: 'admin@test.com', isAdmin: true }),
      params: { id: '99999' },
    });
    expect((await onRequestPatch(ctx)).status).toBe(404);
  });
});
