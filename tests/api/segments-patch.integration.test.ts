/**
 * Integration test — PATCH /api/trips/:id/segments/:sid
 *
 * User override travel mode：set mode_source='user' so recompute 不覆寫。
 * transit mode 必須帶 min（手動輸入）。
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, seedTrip, getDayId, callHandler, seedEntry, jsonRequest } from './helpers';
import { onRequestPatch } from '../../functions/api/trips/[id]/segments/[sid]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
let segId: number;

beforeEach(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  // 清掉前次 segments 避免 UNIQUE 衝突
  await db.prepare('DELETE FROM trip_segments WHERE trip_id LIKE ?').bind('trip-segp%').run();
  await seedTrip(db, { id: 'trip-segp' });
  const day1 = await getDayId(db, 'trip-segp', 1);
  const e1 = await seedEntry(db, day1, { sortOrder: 1 });
  const e2 = await seedEntry(db, day1, { sortOrder: 2 });
  const now = Date.now();
  const r = await db.prepare(
    `INSERT INTO trip_segments
     (trip_id, from_entry_id, to_entry_id, mode, mode_source, min, distance_m, source, computed_at, updated_at)
     VALUES (?, ?, ?, 'walking', 'auto', 5, 400, 'google', ?, ?) RETURNING id`,
  ).bind('trip-segp', e1, e2, now, now).first<{ id: number }>();
  segId = r!.id;
});

afterAll(disposeMiniflare);

describe('PATCH /api/trips/:id/segments/:sid', () => {
  it('mode=driving → 200 + mode_source=user (recompute 不覆寫)', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-segp/segments/${segId}`, 'PATCH', { mode: 'driving' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-segp', sid: String(segId) },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(200);
    const updated = await db.prepare('SELECT mode, mode_source FROM trip_segments WHERE id = ?').bind(segId).first<{ mode: string; mode_source: string }>();
    expect(updated!.mode).toBe('driving');
    expect(updated!.mode_source).toBe('user');
  });

  it('mode=transit 無 min → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-segp/segments/${segId}`, 'PATCH', { mode: 'transit' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-segp', sid: String(segId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(400);
  });

  it('mode=transit + min=30 → 200 + source=manual', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-segp/segments/${segId}`, 'PATCH', { mode: 'transit', min: 30 }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-segp', sid: String(segId) },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(200);
    const updated = await db.prepare('SELECT mode, "min", source, mode_source FROM trip_segments WHERE id = ?').bind(segId).first<{ mode: string; min: number; source: string; mode_source: string }>();
    expect(updated!.mode).toBe('transit');
    expect(updated!.min).toBe(30);
    expect(updated!.source).toBe('manual');
    expect(updated!.mode_source).toBe('user');
  });

  it('mode invalid (flying) → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-segp/segments/${segId}`, 'PATCH', { mode: 'flying' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-segp', sid: String(segId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(400);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-segp/segments/${segId}`, 'PATCH', { mode: 'walking' }),
      env,
      params: { id: 'trip-segp', sid: String(segId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(401);
  });

  it('segment 不屬於該 trip → 404 (IDOR 防護)', async () => {
    await seedTrip(db, { id: 'trip-other-segp' });
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-other-segp/segments/${segId}`, 'PATCH', { mode: 'walking' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-other-segp', sid: String(segId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(404);
  });
});
