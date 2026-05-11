/**
 * Integration test — PATCH /api/trips/:id/segments/:sid
 *
 * User override travel mode：set mode_source='user' so recompute 不覆寫。
 * transit mode 必須帶 min（手動輸入）。
 *
 * v2.26.2 regression：mode 從 driving 切 walking（或反向）且 user 未帶 min →
 * backend 必須自動 call Google Routes 重算 min（不能保留舊 mode 的時間）。
 * Bug 觀察：v2.26.0 EditEntryPage 切 mode 後顯示「步行 17 min / 9.3 km」（17 min
 * 是 driving 時間）。
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

// Mock computeRoute：用座標距離模擬，WALK=5km/h DRIVE=30km/h
vi.mock('../../src/server/maps/google-client', () => ({
  computeRoute: vi.fn(async (
    _apiKey: string,
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    mode: 'WALK' | 'DRIVE' | 'TRANSIT' | 'BICYCLE',
  ) => {
    const km = Math.sqrt(
      ((destination.lat - origin.lat) * 111) ** 2 +
      ((destination.lng - origin.lng) * 111 * Math.cos((origin.lat * Math.PI) / 180)) ** 2,
    );
    const distM = Math.round(km * 1000);
    const speedKmh = mode === 'WALK' ? 5 : 30;
    const seconds = Math.round((km / speedKmh) * 3600);
    return { polyline: 'mock', distance_meters: distM, duration_seconds: seconds };
  }),
}));

vi.mock('../../functions/api/_maps_lock', () => ({
  assertGoogleAvailable: vi.fn(async () => undefined),
}));

import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, seedTrip, getDayId, callHandler, seedEntry, seedPoi, jsonRequest } from './helpers';
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

  it('mode=transit + min=99999 (> 1440 上界) → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-segp/segments/${segId}`, 'PATCH', { mode: 'transit', min: 99999 }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-segp', sid: String(segId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(400);
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

// v2.26.2 regression — mode 切換後 min 自動重算
describe('PATCH /api/trips/:id/segments/:sid — mode change auto-recompute (v2.26.2)', () => {
  let segIdR: number;

  beforeEach(async () => {
    await db.prepare('DELETE FROM trip_segments WHERE trip_id LIKE ?').bind('trip-segr%').run();
    // 用 override env 補上 GOOGLE_MAPS_API_KEY（recompute path 必須）
    env = mockEnv(db, { GOOGLE_MAPS_API_KEY: 'test-google-key' });
    await seedTrip(db, { id: 'trip-segr' });
    const day1 = await getDayId(db, 'trip-segr', 1);
    // 9.3km apart：mock computeRoute → DRIVE ~18min, WALK ~111min
    const suffix = Math.random().toString(36).slice(2, 8);
    const poiA = await seedPoi(db, { name: `segr-A-${suffix}` });
    await db.prepare('UPDATE pois SET lat=?, lng=? WHERE id=?').bind(26.4937, 127.9202, poiA).run();
    const poiB = await seedPoi(db, { name: `segr-B-${suffix}` });
    await db.prepare('UPDATE pois SET lat=?, lng=? WHERE id=?').bind(26.5687, 127.8826, poiB).run();
    const e1 = await seedEntry(db, day1, { sortOrder: 1, poiId: poiA });
    const e2 = await seedEntry(db, day1, { sortOrder: 2, poiId: poiB });
    const now = Date.now();
    // 起始為 driving / 18min（mock 速度算出）
    const r = await db.prepare(
      `INSERT INTO trip_segments
       (trip_id, from_entry_id, to_entry_id, mode, mode_source, min, distance_m, source, computed_at, updated_at)
       VALUES (?, ?, ?, 'driving', 'auto', 18, 9300, 'google', ?, ?) RETURNING id`,
    ).bind('trip-segr', e1, e2, now, now).first<{ id: number }>();
    segIdR = r!.id;
  });

  it('mode driving→walking 不帶 min → backend 重算 min（不保留 driving 時間）', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-segr/segments/${segIdR}`, 'PATCH', { mode: 'walking' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-segr', sid: String(segIdR) },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(200);
    const updated = await db.prepare('SELECT mode, mode_source, "min", source, distance_m FROM trip_segments WHERE id = ?')
      .bind(segIdR).first<{ mode: string; mode_source: string; min: number; source: string; distance_m: number }>();
    expect(updated!.mode).toBe('walking');
    expect(updated!.mode_source).toBe('user'); // user override mode 不被 auto recompute 蓋
    expect(updated!.source).toBe('google');     // 重算來自 Google Routes
    // 9.3km / 5km/h ≈ 111 min；不該保留 driving 的 18 min
    expect(updated!.min).toBeGreaterThanOrEqual(90);
    expect(updated!.min).toBeLessThanOrEqual(130);
  });

  it('mode walking→driving 不帶 min → backend 重算 min（不保留 walking 時間）', async () => {
    // 先改成 walking baseline
    await db.prepare('UPDATE trip_segments SET mode = ?, "min" = ? WHERE id = ?').bind('walking', 111, segIdR).run();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-segr/segments/${segIdR}`, 'PATCH', { mode: 'driving' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-segr', sid: String(segIdR) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(200);
    const updated = await db.prepare('SELECT mode, "min", source FROM trip_segments WHERE id = ?')
      .bind(segIdR).first<{ mode: string; min: number; source: string }>();
    expect(updated!.mode).toBe('driving');
    expect(updated!.source).toBe('google');
    // 9.3km / 30km/h ≈ 18 min；不該保留 walking 的 111 min
    expect(updated!.min).toBeGreaterThanOrEqual(15);
    expect(updated!.min).toBeLessThanOrEqual(25);
  });

  it('user 自帶 min 時不重算 — manual override 優先', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-segr/segments/${segIdR}`, 'PATCH', { mode: 'walking', min: 42 }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-segr', sid: String(segIdR) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(200);
    const updated = await db.prepare('SELECT mode, "min", source FROM trip_segments WHERE id = ?')
      .bind(segIdR).first<{ mode: string; min: number; source: string }>();
    expect(updated!.mode).toBe('walking');
    expect(updated!.min).toBe(42);
    expect(updated!.source).toBe('manual');
  });

  it('entries 缺 coords → 保留舊 min（不能 call Google，fallback）', async () => {
    // 把 POI 座標清掉模擬缺資料
    await db.prepare('UPDATE pois SET lat=NULL, lng=NULL WHERE id IN (SELECT poi_id FROM trip_entries WHERE id IN (SELECT from_entry_id FROM trip_segments WHERE id = ?))').bind(segIdR).run();
    await db.prepare('UPDATE pois SET lat=NULL, lng=NULL WHERE id IN (SELECT poi_id FROM trip_entries WHERE id IN (SELECT to_entry_id FROM trip_segments WHERE id = ?))').bind(segIdR).run();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-segr/segments/${segIdR}`, 'PATCH', { mode: 'walking' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-segr', sid: String(segIdR) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(200);
    const updated = await db.prepare('SELECT mode, "min" FROM trip_segments WHERE id = ?')
      .bind(segIdR).first<{ mode: string; min: number }>();
    expect(updated!.mode).toBe('walking');
    expect(updated!.min).toBe(18); // 保留原 driving 時間（fallback）
  });
});
