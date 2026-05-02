/**
 * Integration test — GET/PUT /api/trips/:id
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip , callHandler } from './helpers';
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
    const resp = await callHandler(onRequestGet, ctx);
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
    expect((await callHandler(onRequestGet, ctx)).status).toBe(404);
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
    const resp = await callHandler(onRequestPut, ctx);
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
    expect((await callHandler(onRequestPut, ctx)).status).toBe(401);
  });

  it('無權限 → 403', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-1', 'PUT', { title: 'x' }),
      env,
      auth: mockAuth({ email: 'stranger@test.com' }),
      params: { id: 'trip-1' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(403);
  });

  // OSM PR (migration 0045)：destinations[] full-replacement semantics on PUT。
  it('帶 destinations[] → 全量取代 trip_destinations + scalar field 一起更新', async () => {
    // First seed an existing destination for trip-1
    await db.prepare(
      `INSERT INTO trip_destinations (trip_id, dest_order, name, lat, lng, day_quota, osm_id, osm_type)
       VALUES ('trip-1', 0, '原沖繩', 26.21, 127.68, 5, 100, 'node')`,
    ).run();

    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-1', 'PUT', {
        title: '帶 dest 的更新',
        destinations: [
          { name: '京都', lat: 35.01, lng: 135.76, day_quota: 3, osm_id: 200, osm_type: 'node' },
          { name: '大阪', lat: 34.69, lng: 135.50, day_quota: 2, osm_id: 201, osm_type: 'relation' },
        ],
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-1' },
    });
    const resp = await callHandler(onRequestPut, ctx);
    expect(resp.status).toBe(200);

    const trip = await db.prepare('SELECT title FROM trips WHERE id = ?').bind('trip-1').first();
    expect((trip as Record<string, unknown>).title).toBe('帶 dest 的更新');

    const dests = await db.prepare(
      'SELECT name, dest_order, day_quota, osm_id, osm_type FROM trip_destinations WHERE trip_id = ? ORDER BY dest_order',
    ).bind('trip-1').all();
    expect(dests.results).toHaveLength(2);
    expect((dests.results[0] as Record<string, unknown>).name).toBe('京都');
    expect((dests.results[0] as Record<string, unknown>).day_quota).toBe(3);
    expect((dests.results[1] as Record<string, unknown>).name).toBe('大阪');
    expect((dests.results[1] as Record<string, unknown>).osm_type).toBe('relation');
    // Old 「原沖繩」 should be gone (full-replacement)
    const old = await db.prepare("SELECT name FROM trip_destinations WHERE trip_id = ? AND name = '原沖繩'")
      .bind('trip-1').first();
    expect(old).toBeNull();
  });

  it('帶空 destinations[] → 清光 trip_destinations', async () => {
    // Seed existing dests first
    await db.prepare(
      `INSERT INTO trip_destinations (trip_id, dest_order, name) VALUES ('trip-1', 0, '臨時')`,
    ).run();

    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-1', 'PUT', { destinations: [] }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-1' },
    });
    const resp = await callHandler(onRequestPut, ctx);
    expect(resp.status).toBe(200);

    const dests = await db.prepare(
      'SELECT COUNT(*) as cnt FROM trip_destinations WHERE trip_id = ?',
    ).bind('trip-1').first();
    expect((dests as Record<string, unknown>).cnt).toBe(0);
  });

  // 2026-05-02 follow-up: enum validation defense-in-depth
  it('default_travel_mode 非 enum 值 → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-1', 'PUT', { default_travel_mode: 'flying' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-1' },
    });
    const resp = await callHandler(onRequestPut, ctx);
    expect(resp.status).toBe(400);
  });

  it('lang 非 enum 值 → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-1', 'PUT', { lang: 'klingon' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-1' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(400);
  });

  it('default_travel_mode 合法 enum → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-1', 'PUT', { default_travel_mode: 'walking' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-1' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(200);
    const trip = await db.prepare('SELECT default_travel_mode FROM trips WHERE id = ?').bind('trip-1').first();
    expect((trip as Record<string, unknown>).default_travel_mode).toBe('walking');
  });

  it('body 完全空 → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-1', 'PUT', {}),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-1' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(400);
  });

  // /review-fix: hostile payload guards
  it('destinations 數量超過上限 (>30) → 400', async () => {
    const tooMany = Array.from({ length: 31 }, (_, i) => ({ name: `dest-${i}`, osm_id: 1000 + i }));
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-1', 'PUT', { destinations: tooMany }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-1' },
    });
    const resp = await callHandler(onRequestPut, ctx);
    expect(resp.status).toBe(400);
  });

  it('sub_areas 不是 string array → 寫入 NULL（防 nested object 撐爆 row）', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-1', 'PUT', {
        destinations: [
          { name: '惡意 sub_areas', sub_areas: { nested: { deeply: 'evil' } }, osm_id: 999 },
        ],
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-1' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(200);
    const dest = await db.prepare('SELECT sub_areas FROM trip_destinations WHERE name = ?')
      .bind('惡意 sub_areas').first();
    expect((dest as Record<string, unknown>).sub_areas).toBeNull();
  });

  it('sub_areas 是 string array → 正常 JSON 寫入', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-1', 'PUT', {
        destinations: [
          { name: '正常 sub_areas', sub_areas: ['梅田', '難波'], osm_id: 998 },
        ],
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-1' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(200);
    const dest = await db.prepare('SELECT sub_areas FROM trip_destinations WHERE name = ?')
      .bind('正常 sub_areas').first();
    expect(JSON.parse((dest as Record<string, unknown>).sub_areas as string)).toEqual(['梅田', '難波']);
  });
});
