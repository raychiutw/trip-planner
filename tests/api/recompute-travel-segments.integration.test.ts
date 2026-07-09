/**
 * Integration test — POST /api/trips/:id/recompute-travel
 *
 * v2.24.0 spec + v2.30.0 mode_source DROPPED：
 *   - 1km gate (Haversine)：≤1km → mode='walking' + WALK API；>1km → 'driving' + DRIVE API
 *   - mode='transit' 既有 segment **不**覆寫（transit 自然代理 user override）
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
  // v2.29.0: seedEntry({poiId}) 已自動 INSERT trip_entry_pois sort_order=1。
  const e1 = await seedEntry(db, day1, { sortOrder: 1, poiId: poiA });
  const e2 = await seedEntry(db, day1, { sortOrder: 2, poiId: poiB });
  const e3 = await seedEntry(db, day1, { sortOrder: 3, poiId: poiC });
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
      'SELECT from_entry_id, to_entry_id, mode, source FROM trip_segments WHERE trip_id = ? ORDER BY from_entry_id',
    ).bind('trip-rec-1').all<{ from_entry_id: number; to_entry_id: number; mode: string; source: string }>();
    expect(segs.results).toHaveLength(2);
    expect(segs.results[0]).toMatchObject({ from_entry_id: e1, to_entry_id: e2, mode: 'walking', source: 'google' });
    expect(segs.results[1]).toMatchObject({ from_entry_id: e2, to_entry_id: e3, mode: 'driving', source: 'google' });
  });

  it('既有 mode=transit segment 被 skip（不覆寫）', async () => {
    const { e1, e2 } = await setupTripWithEntries('trip-rec-user');
    // 預先插一個 transit segment（A→B）user 手填 min
    const now = Date.now();
    await db.prepare(
      `INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, min, distance_m, source, computed_at, updated_at)
       VALUES (?, ?, ?, 'transit', 999, NULL, 'manual', ?, ?)`,
    ).bind('trip-rec-user', e1, e2, now, now).run();

    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-rec-user/recompute-travel?day=all', 'POST'),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-rec-user' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);
    const body = await resp.json() as { pairsSkippedTransit: number; pairsComputed: number };
    expect(body.pairsSkippedTransit).toBe(1);
    expect(body.pairsComputed).toBe(1); // 只算了 B→C

    // 驗 transit segment 沒被覆寫
    const seg = await db.prepare(
      'SELECT mode, "min" FROM trip_segments WHERE from_entry_id = ? AND to_entry_id = ?',
    ).bind(e1, e2).first<{ mode: string; min: number }>();
    expect(seg).toMatchObject({ mode: 'transit', min: 999 });
  });

  it('既有 driving/walking segment 會被重新覆寫', async () => {
    const { e1, e2 } = await setupTripWithEntries('trip-rec-auto');
    const now = Date.now();
    await db.prepare(
      `INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, min, distance_m, source, computed_at, updated_at)
       VALUES (?, ?, ?, 'driving', 100, 99999, 'google', ?, ?)`,
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

  it('entry reorder 後清掉同日非相鄰 stale segments，只留下目前 pair', async () => {
    const { e1, e2, e3 } = await setupTripWithEntries('trip-rec-prune');
    const day2 = await getDayId(db, 'trip-rec-prune', 2);
    const otherPoiA = await seedPoi(db, { name: 'OtherA' });
    await db.prepare('UPDATE pois SET lat=?, lng=? WHERE id=?').bind(26.3, 127.7, otherPoiA).run();
    const otherPoiB = await seedPoi(db, { name: 'OtherB' });
    await db.prepare('UPDATE pois SET lat=?, lng=? WHERE id=?').bind(26.31, 127.71, otherPoiB).run();
    const otherE1 = await seedEntry(db, day2, { sortOrder: 1, poiId: otherPoiA });
    const otherE2 = await seedEntry(db, day2, { sortOrder: 2, poiId: otherPoiB });

    const now = Date.now();
    await db.batch([
      db.prepare(
        `INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, min, distance_m, source, computed_at, updated_at)
         VALUES (?, ?, ?, 'driving', 11, 1100, 'google', ?, ?)`,
      ).bind('trip-rec-prune', e1, e2, now - 1000, now - 1000),
      db.prepare(
        `INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, min, distance_m, source, computed_at, updated_at)
         VALUES (?, ?, ?, 'driving', 22, 2200, 'google', ?, ?)`,
      ).bind('trip-rec-prune', e2, e3, now - 1000, now - 1000),
      db.prepare(
        `INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, min, distance_m, source, computed_at, updated_at)
         VALUES (?, ?, ?, 'driving', 33, 3300, 'google', ?, ?)`,
      ).bind('trip-rec-prune', otherE1, otherE2, now - 1000, now - 1000),
    ]);

    // Reorder day 1 from A,B,C to B,A,C. Old A->B and B->C are no longer adjacent.
    await db.batch([
      db.prepare('UPDATE trip_entries SET sort_order = 1 WHERE id = ?').bind(e2),
      db.prepare('UPDATE trip_entries SET sort_order = 2 WHERE id = ?').bind(e1),
      db.prepare('UPDATE trip_entries SET sort_order = 3 WHERE id = ?').bind(e3),
    ]);

    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-rec-prune/recompute-travel?day=1', 'POST'),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-rec-prune' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);
    const body = await resp.json() as { segmentsPruned: number };
    expect(body.segmentsPruned).toBe(2);

    const segs = await db.prepare(
      'SELECT from_entry_id, to_entry_id FROM trip_segments WHERE trip_id = ? ORDER BY from_entry_id, to_entry_id',
    ).bind('trip-rec-prune').all<{ from_entry_id: number; to_entry_id: number }>();
    expect(segs.results).toEqual([
      { from_entry_id: e1, to_entry_id: e3 },
      { from_entry_id: e2, to_entry_id: e1 },
      { from_entry_id: otherE1, to_entry_id: otherE2 },
    ]);
  });

  it('recompute day=1 也清掉 day=2 的 orphan segment（trip-wide prune，非只 scoped day）', async () => {
    await setupTripWithEntries('trip-rec-crossday');
    const day2 = await getDayId(db, 'trip-rec-crossday', 2);
    const f1poi = await seedPoi(db, { name: 'F1' });
    await db.prepare('UPDATE pois SET lat=?, lng=? WHERE id=?').bind(26.5, 127.9, f1poi).run();
    const f2poi = await seedPoi(db, { name: 'F2' });
    await db.prepare('UPDATE pois SET lat=?, lng=? WHERE id=?').bind(26.51, 127.91, f2poi).run();
    const f1 = await seedEntry(db, day2, { sortOrder: 1, poiId: f1poi });
    const f2 = await seedEntry(db, day2, { sortOrder: 2, poiId: f2poi });

    const now = Date.now();
    // day2 目前相鄰是 f1→f2；插一個反向 orphan f2→f1（曾 reorder / 刪景點殘留）
    await db.prepare(
      `INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, min, distance_m, source, computed_at, updated_at)
       VALUES (?, ?, ?, 'driving', 88, 8800, 'google', ?, ?)`,
    ).bind('trip-rec-crossday', f2, f1, now - 1000, now - 1000).run();

    // 只 recompute day=1，但 day=2 的 orphan 也要被 trip-wide 清掉
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-rec-crossday/recompute-travel?day=1', 'POST'),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-rec-crossday' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);
    const body = await resp.json() as { segmentsPruned: number };
    expect(body.segmentsPruned).toBe(1);

    // day2 反向 orphan f2→f1 應已被清（即使只 recompute day=1）
    const orphan = await db.prepare(
      'SELECT id FROM trip_segments WHERE from_entry_id = ? AND to_entry_id = ?',
    ).bind(f2, f1).first();
    expect(orphan).toBeNull();
  });

  it('trip-wide prune 不誤清非 scoped day 的有效段（transit 手填 + NULL placeholder 都存活）', async () => {
    await setupTripWithEntries('trip-rec-keepvalid');
    const day2 = await getDayId(db, 'trip-rec-keepvalid', 2);
    const g1poi = await seedPoi(db, { name: 'G1' });
    await db.prepare('UPDATE pois SET lat=?, lng=? WHERE id=?').bind(26.6, 128.0, g1poi).run();
    const g2poi = await seedPoi(db, { name: 'G2' });
    await db.prepare('UPDATE pois SET lat=?, lng=? WHERE id=?').bind(26.61, 128.01, g2poi).run();
    const g3poi = await seedPoi(db, { name: 'G3' });
    await db.prepare('UPDATE pois SET lat=?, lng=? WHERE id=?').bind(26.62, 128.02, g3poi).run();
    const g1 = await seedEntry(db, day2, { sortOrder: 1, poiId: g1poi });
    const g2 = await seedEntry(db, day2, { sortOrder: 2, poiId: g2poi });
    const g3 = await seedEntry(db, day2, { sortOrder: 3, poiId: g3poi });

    const now = Date.now();
    await db.batch([
      // g1→g2：user 手填 transit（min 不可重算，current-adjacent 不該被清）
      db.prepare(
        `INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, min, distance_m, source, computed_at, updated_at)
         VALUES (?, ?, ?, 'transit', 55, NULL, 'manual', ?, ?)`,
      ).bind('trip-rec-keepvalid', g1, g2, now, now),
      // g2→g3：self-heal placeholder（既有段被標 stale：computed_at=NULL；current-adjacent 不該被清）
      db.prepare(
        `INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, min, distance_m, source, computed_at, updated_at)
         VALUES (?, ?, ?, 'driving', NULL, NULL, 'google', NULL, ?)`,
      ).bind('trip-rec-keepvalid', g2, g3, now),
    ]);

    // 只 recompute day=1；day=2 的 transit + placeholder 皆 current-adjacent → 應存活
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-rec-keepvalid/recompute-travel?day=1', 'POST'),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-rec-keepvalid' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);
    const body = await resp.json() as { segmentsPruned: number };
    expect(body.segmentsPruned).toBe(0);

    const transitSeg = await db.prepare(
      'SELECT mode, "min" FROM trip_segments WHERE from_entry_id = ? AND to_entry_id = ?',
    ).bind(g1, g2).first<{ mode: string; min: number }>();
    expect(transitSeg).toMatchObject({ mode: 'transit', min: 55 });

    const placeholderSeg = await db.prepare(
      'SELECT computed_at FROM trip_segments WHERE from_entry_id = ? AND to_entry_id = ?',
    ).bind(g2, g3).first<{ computed_at: number | null }>();
    expect(placeholderSeg).not.toBeNull();
    expect(placeholderSeg!.computed_at).toBeNull();
  });

  // v2.29.0: 「dual-write trip_entries.travel_*」test removed — trip_entries.travel_* DROPPED。
  // travel 物件單一 source 改為 trip_segments（測在 days/days-num tests 涵蓋）。

  it('未認證 → 401', async () => {
    await setupTripWithEntries('trip-rec-noauth');
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-rec-noauth/recompute-travel', 'POST'),
      env,
      params: { id: 'trip-rec-noauth' },
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(401);
  });

  // v2.33.106 T-4: failure paths — 補既有 happy path 缺乏的 negative tests
  describe('failure paths (T-4)', () => {
    it('無寫權限 user → 403', async () => {
      await setupTripWithEntries('trip-rec-noperm');
      const ctx = mockContext({
        request: jsonRequest('https://test.com/api/trips/trip-rec-noperm/recompute-travel', 'POST'),
        env,
        auth: mockAuth({ email: 'stranger@test.com', userId: 'stranger-1' }),
        params: { id: 'trip-rec-noperm' },
      });
      expect((await callHandler(onRequestPost, ctx)).status).toBe(403);
    });

    it('trip 不存在 → 403（沒寫權限視為不存在）', async () => {
      const ctx = mockContext({
        request: jsonRequest('https://test.com/api/trips/trip-rec-missing/recompute-travel', 'POST'),
        env,
        auth: mockAuth({ email: 'user@test.com' }),
        params: { id: 'trip-rec-missing' },
      });
      const status = (await callHandler(onRequestPost, ctx)).status;
      expect([403, 404]).toContain(status);
    });

    it('trip 沒任何 entry → 0 pairs computed', async () => {
      await seedTrip(db, { id: 'trip-rec-empty' });
      const ctx = mockContext({
        request: jsonRequest('https://test.com/api/trips/trip-rec-empty/recompute-travel?day=all', 'POST'),
        env,
        auth: mockAuth({ email: 'user@test.com' }),
        params: { id: 'trip-rec-empty' },
      });
      const resp = await callHandler(onRequestPost, ctx);
      expect(resp.status).toBe(200);
      const body = await resp.json() as { pairsComputed: number };
      expect(body.pairsComputed).toBe(0);
    });

    it('GOOGLE_MAPS_API_KEY 缺 → 500 / 502', async () => {
      const envNoKey = mockEnv(db);
      envNoKey.GOOGLE_MAPS_API_KEY = '';
      await setupTripWithEntries('trip-rec-nokey');
      const ctx = mockContext({
        request: jsonRequest('https://test.com/api/trips/trip-rec-nokey/recompute-travel?day=all', 'POST'),
        env: envNoKey,
        auth: mockAuth({ email: 'user@test.com' }),
        params: { id: 'trip-rec-nokey' },
      });
      const status = (await callHandler(onRequestPost, ctx)).status;
      expect([500, 502]).toContain(status);
    });

    it('Entry 缺 lat/lng → pair 被 skip（不算 computed）', async () => {
      await seedTrip(db, { id: 'trip-rec-nocoord' });
      const day1 = await getDayId(db, 'trip-rec-nocoord', 1);
      const poiA = await seedPoi(db, { name: 'NoCoordA' });
      // 不更新 lat/lng → 預設 null
      const poiB = await seedPoi(db, { name: 'NoCoordB' });
      await db.prepare('UPDATE pois SET lat=?, lng=? WHERE id=?').bind(26.0, 127.0, poiB).run();
      await seedEntry(db, day1, { sortOrder: 1, poiId: poiA });
      await seedEntry(db, day1, { sortOrder: 2, poiId: poiB });

      const ctx = mockContext({
        request: jsonRequest('https://test.com/api/trips/trip-rec-nocoord/recompute-travel?day=all', 'POST'),
        env,
        auth: mockAuth({ email: 'user@test.com' }),
        params: { id: 'trip-rec-nocoord' },
      });
      const resp = await callHandler(onRequestPost, ctx);
      expect(resp.status).toBe(200);
      const body = await resp.json() as { pairsComputed: number };
      // 缺 coords 的 pair 不該被算進 google route
      expect(body.pairsComputed).toBe(0);
    });
  });
});
