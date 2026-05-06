/**
 * Integration test — POST /api/trips/:id/recompute-travel
 *
 * v2.24.0 spec：
 *   - 1km gate (Haversine)：≤1km → mode='walking' + WALK API；>1km → 'driving' + DRIVE API
 *   - mode_source='user' 既有 segment **不**覆寫
 *   - 寫 trip_segments + dual-write trip_entries.travel_* (legacy)
 *
 * Mock：computeRoute 用 vi.mock 攔截，不打真實 Google Routes API。
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

vi.mock('../../src/server/maps/google-client', () => ({
  computeRoute: vi.fn(async (
    _apiKey: string,
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    mode: 'WALK' | 'DRIVE' | 'TRANSIT' | 'BICYCLE',
  ) => {
    // 用座標距離模擬 — WALK = 5km/h, DRIVE = 30km/h
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
import { onRequestPost } from '../../functions/api/trips/[id]/recompute-travel';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

async function setupTripWithEntries(tripId: string) {
  await seedTrip(db, { id: tripId });
  const day1 = await getDayId(db, tripId, 1);
  // 3 entries：A → B（500m, walk）, B → C（17km, drive）
  const poiA = await seedPoi(db, { name: 'A' });
  await db.prepare('UPDATE pois SET lat=?, lng=? WHERE id=?').bind(26.3175, 127.7539, poiA).run();
  const poiB = await seedPoi(db, { name: 'B' });
  await db.prepare('UPDATE pois SET lat=?, lng=? WHERE id=?').bind(26.3175, 127.7589, poiB).run(); // ~500m east
  const poiC = await seedPoi(db, { name: 'C' });
  await db.prepare('UPDATE pois SET lat=?, lng=? WHERE id=?').bind(26.196, 127.6458, poiC).run(); // 那霸機場（~17km）
  const e1 = await seedEntry(db, day1, { sortOrder: 1, title: 'A', poiId: poiA });
  const e2 = await seedEntry(db, day1, { sortOrder: 2, title: 'B', poiId: poiB });
  const e3 = await seedEntry(db, day1, { sortOrder: 3, title: 'C', poiId: poiC });
  return { e1, e2, e3 };
}

beforeEach(async () => {
  db = await createTestDb();
  env = mockEnv(db, { GOOGLE_MAPS_API_KEY: 'test-key' } as Partial<Env>);
  // 清掉前次 segments + entries 避免 UNIQUE 衝突
  await db.prepare('DELETE FROM trip_segments WHERE trip_id LIKE ?').bind('trip-rec%').run();
  await db.prepare('DELETE FROM trip_entries WHERE day_id IN (SELECT id FROM trip_days WHERE trip_id LIKE ?)').bind('trip-rec%').run();
  await db.prepare('DELETE FROM pois WHERE name IN (?, ?, ?)').bind('A', 'B', 'C').run();
});

afterAll(disposeMiniflare);

describe('POST /api/trips/:id/recompute-travel — 1km gate + segments', () => {
  it('A→B (500m) → walking segment + B→C (17km) → driving segment', async () => {
    const { e1, e2, e3 } = await setupTripWithEntries('trip-rec-1');
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-rec-1/recompute-travel?day=all', 'POST'),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-rec-1' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);
    const body = await resp.json() as { pairsComputed: number; modeBreakdown: Record<string, number> };
    expect(body.pairsComputed).toBe(2);
    expect(body.modeBreakdown).toEqual({ walking: 1, driving: 1 });

    const segs = await db.prepare(
      'SELECT from_entry_id, to_entry_id, mode, mode_source, source FROM trip_segments WHERE trip_id = ? ORDER BY from_entry_id',
    ).bind('trip-rec-1').all<{ from_entry_id: number; to_entry_id: number; mode: string; mode_source: string; source: string }>();
    expect(segs.results).toHaveLength(2);
    expect(segs.results[0]).toMatchObject({ from_entry_id: e1, to_entry_id: e2, mode: 'walking', mode_source: 'auto', source: 'google' });
    expect(segs.results[1]).toMatchObject({ from_entry_id: e2, to_entry_id: e3, mode: 'driving', mode_source: 'auto', source: 'google' });
  });

  it('既有 mode_source=user segment 被 skip（不覆寫）', async () => {
    const { e1, e2 } = await setupTripWithEntries('trip-rec-user');
    // 預先插一個 user-locked walking segment（A→B）
    const now = Date.now();
    await db.prepare(
      `INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, mode_source, min, distance_m, source, computed_at, updated_at)
       VALUES (?, ?, ?, 'transit', 'user', 999, 0, 'manual', ?, ?)`,
    ).bind('trip-rec-user', e1, e2, now, now).run();

    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-rec-user/recompute-travel?day=all', 'POST'),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-rec-user' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);
    const body = await resp.json() as { pairsSkippedUser: number; pairsComputed: number };
    expect(body.pairsSkippedUser).toBe(1);
    expect(body.pairsComputed).toBe(1); // 只算了 B→C

    // 驗 user-locked segment 沒被覆寫
    const seg = await db.prepare(
      'SELECT mode, mode_source, "min" FROM trip_segments WHERE from_entry_id = ? AND to_entry_id = ?',
    ).bind(e1, e2).first<{ mode: string; mode_source: string; min: number }>();
    expect(seg).toMatchObject({ mode: 'transit', mode_source: 'user', min: 999 });
  });

  it('既有 mode_source=auto segment 會被重新覆寫', async () => {
    const { e1, e2 } = await setupTripWithEntries('trip-rec-auto');
    const now = Date.now();
    await db.prepare(
      `INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, mode_source, min, distance_m, source, computed_at, updated_at)
       VALUES (?, ?, ?, 'driving', 'auto', 100, 99999, 'google', ?, ?)`,
    ).bind('trip-rec-auto', e1, e2, now - 10000, now - 10000).run();

    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-rec-auto/recompute-travel?day=all', 'POST'),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-rec-auto' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);

    // A→B 應被改回 walking（500m ≤ 1km）
    const seg = await db.prepare(
      'SELECT mode, "min", distance_m FROM trip_segments WHERE from_entry_id = ? AND to_entry_id = ?',
    ).bind(e1, e2).first<{ mode: string; min: number; distance_m: number }>();
    expect(seg!.mode).toBe('walking');
    expect(seg!.distance_m).toBeLessThan(1000);
  });

  it('dual-write trip_entries.travel_* (legacy until Phase ε)', async () => {
    const { e2, e3 } = await setupTripWithEntries('trip-rec-dual');
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-rec-dual/recompute-travel?day=all', 'POST'),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-rec-dual' },
    });
    await callHandler(onRequestPost, ctx);

    // entry e2 應有 travel data（A→B walking 500m）
    const e2row = await db.prepare(
      'SELECT travel_type, travel_min, travel_distance_m, travel_source FROM trip_entries WHERE id = ?',
    ).bind(e2).first<{ travel_type: string; travel_min: number; travel_distance_m: number; travel_source: string }>();
    expect(e2row!.travel_type).toBe('walking');
    expect(e2row!.travel_source).toBe('google');

    // entry e3 應有 travel data（B→C driving ~17km）
    const e3row = await db.prepare(
      'SELECT travel_type, travel_distance_m FROM trip_entries WHERE id = ?',
    ).bind(e3).first<{ travel_type: string; travel_distance_m: number }>();
    expect(e3row!.travel_type).toBe('driving');
    expect(e3row!.travel_distance_m).toBeGreaterThan(15000);
  });

  it('未認證 → 401', async () => {
    await setupTripWithEntries('trip-rec-noauth');
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-rec-noauth/recompute-travel', 'POST'),
      env,
      params: { id: 'trip-rec-noauth' },
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(401);
  });
});
