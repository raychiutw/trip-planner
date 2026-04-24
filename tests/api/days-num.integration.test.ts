/**
 * Integration test — GET/PUT /api/trips/:id/days/:num
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip, getDayId , callHandler } from './helpers';
import { onRequestGet, onRequestPut } from '../../functions/api/trips/[id]/days/[num]';
import { onRequestPost as onRequestPostEntry } from '../../functions/api/trips/[id]/days/[num]/entries';
import { onRequestPatch as onRequestPatchEntry } from '../../functions/api/trips/[id]/entries/[eid]';
import { onRequestPut as onRequestPutPoiId } from '../../functions/api/trips/[id]/entries/[eid]/poi-id';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-dn', days: 3 });
});

afterAll(disposeMiniflare);

describe('GET /api/trips/:id/days/:num', () => {
  it('取得完整一天資料', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-dn/days/1'),
      env,
      params: { id: 'trip-dn', num: '1' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Record<string, unknown>;
    expect(data.dayNum).toBe(1);
    expect(data.timeline).toBeDefined();
  });

  it('不存在的天 → 404', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-dn/days/99'),
      env,
      params: { id: 'trip-dn', num: '99' },
    });
    expect((await callHandler(onRequestGet, ctx)).status).toBe(404);
  });
});

describe('PUT /api/trips/:id/days/:num', () => {
  it('覆寫整天 + 建立 entry + find-or-create POI → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-dn/days/1', 'PUT', {
        date: '2026-04-01',
        dayOfWeek: '三',
        label: 'Day 1',
        timeline: [
          {
            time: '09:00',
            title: '首里城',
            description: '世界遺產',
            restaurants: [
              { name: 'すし三昧', type: 'restaurant', context: 'timeline' },
            ],
          },
          {
            time: '12:00',
            title: '國際通',
            travel: { type: 'car', desc: '車程', min: 20 },
          },
        ],
        hotel: {
          name: 'ホテルオリオン',
          checkout: '11:00',
        },
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', num: '1' },
    });
    const resp = await callHandler(onRequestPut, ctx);
    expect(resp.status).toBe(200);

    // 驗證 entries 已建立
    const dayId = await getDayId(db, 'trip-dn', 1);
    const entries = await db.prepare(
      'SELECT * FROM trip_entries WHERE day_id = ? ORDER BY sort_order'
    ).bind(dayId).all();
    expect(entries.results).toHaveLength(2);
    expect((entries.results[0] as Record<string, unknown>).title).toBe('首里城');

    // 驗證 hotel POI 已建立
    const hotelPoi = await db.prepare(
      "SELECT * FROM pois WHERE name = 'ホテルオリオン' AND type = 'hotel'"
    ).first();
    expect(hotelPoi).not.toBeNull();

    // 驗證 trip_pois 有 hotel context
    const hotelTp = await db.prepare(
      "SELECT * FROM trip_pois WHERE trip_id = 'trip-dn' AND context = 'hotel' AND day_id = ?"
    ).bind(dayId).first();
    expect(hotelTp).not.toBeNull();
  });

  it('缺 date → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-dn/days/1', 'PUT', {
        dayOfWeek: '三',
        label: 'x',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', num: '1' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(400);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-dn/days/1', 'PUT', {
        date: '2026-04-01', dayOfWeek: '三', label: 'x',
      }),
      env,
      params: { id: 'trip-dn', num: '1' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(401);
  });

  it('無權限 → 403', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-dn/days/1', 'PUT', {
        date: '2026-04-01', dayOfWeek: '三', label: 'x',
      }),
      env,
      auth: mockAuth({ email: 'stranger@test.com' }),
      params: { id: 'trip-dn', num: '1' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(403);
  });

  it('亂碼偵測 → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-dn/days/2', 'PUT', {
        date: '2026-04-02', dayOfWeek: '四', label: 'Day 2',
        timeline: [{ time: '10:00', title: 'test\uFFFDgarbled' }],
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', num: '2' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(400);
  });

  /* Phase 2 POI Unification (v2.1.2.0+) */
  it('Phase 2: entry with maps + poi_type → 寫入 trip_entries.poi_id + pois master', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-dn/days/3', 'PUT', {
        date: '2026-04-03', dayOfWeek: '五', label: 'Day 3',
        timeline: [
          {
            time: '09:00',
            title: '那覇空港',
            poi_type: 'transport',
            maps: 'https://www.google.com/maps/search/那覇空港',
            google_rating: 4.2,
          },
          {
            time: '12:00',
            title: '首里城',
            maps: 'https://www.google.com/maps/search/首里城',
          },
        ],
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', num: '3' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(200);

    const dayId = await getDayId(db, 'trip-dn', 3);
    const entries = await db.prepare(
      'SELECT id, title, poi_id FROM trip_entries WHERE day_id = ? ORDER BY sort_order',
    ).bind(dayId).all();
    expect(entries.results).toHaveLength(2);
    for (const e of entries.results as Array<{ poi_id: number | null }>) {
      expect(e.poi_id).not.toBeNull();
    }

    const transportPoi = await db.prepare(
      "SELECT id, maps, google_rating FROM pois WHERE name = '那覇空港' AND type = 'transport'",
    ).first() as { id: number; maps: string; google_rating: number } | null;
    expect(transportPoi).not.toBeNull();
    expect(transportPoi!.maps).toContain('那覇空港');
    expect(transportPoi!.google_rating).toBe(4.2);

    const attractionPoi = await db.prepare(
      "SELECT id FROM pois WHERE name = '首里城' AND type = 'attraction'",
    ).first();
    expect(attractionPoi).not.toBeNull();
  });

  it('Phase 2: GET /days/:num 回傳 entry.poi JOIN 物件', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-dn/days/3'),
      env,
      params: { id: 'trip-dn', num: '3' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as { timeline: Array<{ title: string; poi: { type: string; maps: string } | null }> };
    const transportEntry = data.timeline.find((e) => e.title === '那覇空港');
    expect(transportEntry).toBeDefined();
    expect(transportEntry!.poi).not.toBeNull();
    expect(transportEntry!.poi!.type).toBe('transport');
    expect(transportEntry!.poi!.maps).toContain('那覇空港');
  });

  it('Phase 2: POST /entries 建立 POI 並回填 poi_id', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-dn/days/2/entries', 'POST', {
        title: '美麗海水族館',
        time: '10:00',
        poi_type: 'attraction',
        maps: 'https://www.google.com/maps/search/美麗海水族館',
        google_rating: 4.5,
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', num: '2' },
    });
    const resp = await callHandler(onRequestPostEntry, ctx);
    expect(resp.status).toBe(201);
    const row = await resp.json() as { id: number; poiId: number; title: string };
    expect(row.poiId).not.toBeNull();
    expect(row.poiId).toBeGreaterThan(0);

    const poi = await db.prepare("SELECT type, name, maps FROM pois WHERE id = ?").bind(row.poiId).first() as { type: string; name: string; maps: string };
    expect(poi.type).toBe('attraction');
    expect(poi.name).toBe('美麗海水族館');
    expect(poi.maps).toContain('美麗海水族館');
  });

  it('Phase 2: PATCH /entries/:eid 不接受 poi_id（避免跨 trip 指向）', async () => {
    const dayId = await getDayId(db, 'trip-dn', 3);
    const entry = await db.prepare(
      'SELECT id, poi_id FROM trip_entries WHERE day_id = ? ORDER BY sort_order LIMIT 1',
    ).bind(dayId).first() as { id: number; poi_id: number };
    const originalPoiId = entry.poi_id;

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-dn/entries/${entry.id}`, 'PATCH', {
        poi_id: 99999,
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', eid: String(entry.id) },
    });
    // poi_id 不在 ALLOWED_FIELDS，PATCH 視為沒有有效欄位 → 400
    expect((await callHandler(onRequestPatchEntry, ctx)).status).toBe(400);

    // poi_id 保持原值未被改動
    const row = await db.prepare('SELECT poi_id FROM trip_entries WHERE id = ?').bind(entry.id).first() as { poi_id: number };
    expect(row.poi_id).toBe(originalPoiId);
  });

  it('Phase 2: PUT /days/:num 拒絕非法 poi_type → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-dn/days/2', 'PUT', {
        date: '2026-04-02', dayOfWeek: '四', label: 'Day 2',
        timeline: [{ time: '10:00', title: 'bad type', poi_type: 'invalid_type' }],
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', num: '2' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(400);
  });

  it('Phase 2: PUT /entries/:eid/poi-id 重掛到既有 POI（驗證存在）', async () => {
    const dayId = await getDayId(db, 'trip-dn', 3);
    const entry = await db.prepare(
      'SELECT id, poi_id FROM trip_entries WHERE day_id = ? ORDER BY sort_order LIMIT 1',
    ).bind(dayId).first() as { id: number; poi_id: number };

    const newPoi = await db.prepare(
      "INSERT INTO pois (type, name, source) VALUES ('attraction', 'Admin Override POI', 'test') RETURNING id",
    ).first() as { id: number };

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-dn/entries/${entry.id}/poi-id`, 'PUT', {
        poi_id: newPoi.id,
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', eid: String(entry.id) },
    });
    const resp = await callHandler(onRequestPutPoiId, ctx);
    expect(resp.status).toBe(200);

    const row = await db.prepare('SELECT poi_id FROM trip_entries WHERE id = ?').bind(entry.id).first() as { poi_id: number };
    expect(row.poi_id).toBe(newPoi.id);
  });

  it('Phase 2: PUT /entries/:eid/poi-id 拒絕不存在的 poi_id → 404', async () => {
    const dayId = await getDayId(db, 'trip-dn', 3);
    const entry = await db.prepare(
      'SELECT id FROM trip_entries WHERE day_id = ? ORDER BY sort_order LIMIT 1',
    ).bind(dayId).first() as { id: number };

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-dn/entries/${entry.id}/poi-id`, 'PUT', {
        poi_id: 99999,
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', eid: String(entry.id) },
    });
    expect((await callHandler(onRequestPutPoiId, ctx)).status).toBe(404);
  });

  it('Phase 2: PUT /entries/:eid/poi-id 允許 null 清空', async () => {
    const dayId = await getDayId(db, 'trip-dn', 3);
    const entry = await db.prepare(
      'SELECT id FROM trip_entries WHERE day_id = ? ORDER BY sort_order LIMIT 1',
    ).bind(dayId).first() as { id: number };

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-dn/entries/${entry.id}/poi-id`, 'PUT', {
        poi_id: null,
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', eid: String(entry.id) },
    });
    expect((await callHandler(onRequestPutPoiId, ctx)).status).toBe(200);
    const row = await db.prepare('SELECT poi_id FROM trip_entries WHERE id = ?').bind(entry.id).first() as { poi_id: number | null };
    expect(row.poi_id).toBeNull();
  });
});
