/**
 * Integration test — GET /api/trips/:id/days（含 summary + ?all=1 batch 模式）
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockContext, seedTrip, seedEntry, seedPoi, seedTripPoi, getDayId, callHandler } from './helpers';
import { onRequestGet } from '../../functions/api/trips/[id]/days';
import { onRequestGet as onRequestGetSingle } from '../../functions/api/trips/[id]/days/[num]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);

  // Trip A: 5 天，Day1 和 Day2 有 entries 和 restaurants（測 cross-day isolation）
  await seedTrip(db, { id: 'trip-days', days: 5 });
  const d1Id = await getDayId(db, 'trip-days', 1);
  const d2Id = await getDayId(db, 'trip-days', 2);

  // Phase 3：spatial 透過 poi JOIN，不再用 entry.location JSON
  const d1EntryPoiId = await seedPoi(db, { type: 'attraction', name: '測試地點' });
  await db.prepare(
    'UPDATE pois SET lat = 26.5, lng = 127.9 WHERE id = ?'
  ).bind(d1EntryPoiId).run();

  const d1EntryId = await seedEntry(db, d1Id, {
    title: 'Day1 Entry',
    sortOrder: 0,
    travelType: 'car',
    travelDesc: '開車前往',
    travelMin: 30,
    poiId: d1EntryPoiId,
  });
  const d2EntryId = await seedEntry(db, d2Id, { title: 'Day2 Entry', sortOrder: 0 });

  // Day1 restaurant POI
  const d1RestId = await seedPoi(db, { type: 'restaurant', name: 'Day1 Restaurant' });
  await seedTripPoi(db, { poiId: d1RestId, tripId: 'trip-days', entryId: d1EntryId, dayId: d1Id, sortOrder: 0 });

  // Day2 restaurant POI
  const d2RestId = await seedPoi(db, { type: 'restaurant', name: 'Day2 Restaurant' });
  await seedTripPoi(db, { poiId: d2RestId, tripId: 'trip-days', entryId: d2EntryId, dayId: d2Id, sortOrder: 0 });

  // Day1 shopping POI（shopping context）
  const d1ShopId = await seedPoi(db, { type: 'shopping', name: 'Day1 Shop' });
  await seedTripPoi(db, {
    poiId: d1ShopId,
    tripId: 'trip-days',
    entryId: d1EntryId,
    dayId: d1Id,
    context: 'shopping',
    must_buy: '紀念品',
  });

  // Day1 hotel + parking（hotel context，entry_id=null）
  const d1HotelId = await seedPoi(db, { type: 'hotel', name: 'Day1 Hotel' });
  await seedTripPoi(db, {
    poiId: d1HotelId,
    tripId: 'trip-days',
    entryId: null,
    dayId: d1Id,
    context: 'hotel',
  });
  const d1ParkId = await seedPoi(db, { type: 'parking', name: 'Day1 Parking' });
  await seedTripPoi(db, {
    poiId: d1ParkId,
    tripId: 'trip-days',
    entryId: null,
    dayId: d1Id,
    context: 'hotel',
  });

  // Trip B: 3 天，無任何 entry / POI（測 fetchPoiMap empty branch）
  await seedTrip(db, { id: 'trip-empty', days: 3 });
});

afterAll(disposeMiniflare);

describe('GET /api/trips/:id/days — summary 模式', () => {
  it('列出所有天（不含 timeline / hotel）', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-days/days'),
      env,
      params: { id: 'trip-days' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<Record<string, unknown>>;
    expect(data).toHaveLength(5);
    expect(data[0].dayNum).toBe(1);
    expect(data[4].dayNum).toBe(5);
    // summary 模式只回傳輕量欄位
    expect(data[0].timeline).toBeUndefined();
    expect(data[0].hotel).toBeUndefined();
  });

  it('不存在的行程 → 空陣列', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/nope/days'),
      env,
      params: { id: 'nope' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    const data = await resp.json() as Array<unknown>;
    expect(data).toHaveLength(0);
  });
});

describe('GET /api/trips/:id/days?all=1 — batch 模式', () => {
  it('回傳完整 days 含 timeline / hotel / POI', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-days/days?all=1'),
      env,
      params: { id: 'trip-days' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<Record<string, unknown>>;
    expect(data).toHaveLength(5);

    const day1 = data[0];
    expect(day1.dayNum).toBe(1);
    expect(Array.isArray(day1.timeline)).toBe(true);
    expect((day1.timeline as unknown[]).length).toBe(1);
  });

  it('POI 不跨天洩漏（Day1/Day2 restaurant 嚴格隔離）', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-days/days?all=1'),
      env,
      params: { id: 'trip-days' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    const data = await resp.json() as Array<Record<string, unknown>>;

    const d1Timeline = data[0].timeline as Array<Record<string, unknown>>;
    const d1Rests = d1Timeline[0].restaurants as Array<Record<string, unknown>>;
    expect(d1Rests).toHaveLength(1);
    expect(d1Rests[0].name).toBe('Day1 Restaurant');
    expect(d1Rests.find(r => r.name === 'Day2 Restaurant')).toBeUndefined();

    const d2Timeline = data[1].timeline as Array<Record<string, unknown>>;
    const d2Rests = d2Timeline[0].restaurants as Array<Record<string, unknown>>;
    expect(d2Rests).toHaveLength(1);
    expect(d2Rests[0].name).toBe('Day2 Restaurant');
    expect(d2Rests.find(r => r.name === 'Day1 Restaurant')).toBeUndefined();
  });

  it('hotel context 正確歸類（含 parking 附加）', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-days/days?all=1'),
      env,
      params: { id: 'trip-days' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    const data = await resp.json() as Array<Record<string, unknown>>;

    const d1 = data[0];
    expect(d1.hotel).toBeTruthy();
    const hotel = d1.hotel as Record<string, unknown>;
    expect(hotel.name).toBe('Day1 Hotel');
    expect(Array.isArray(hotel.parking)).toBe(true);
    const parking = hotel.parking as Array<Record<string, unknown>>;
    expect(parking).toHaveLength(1);
    expect(parking[0].name).toBe('Day1 Parking');

    // Day2 沒有 hotel
    expect(data[1].hotel).toBeNull();
  });

  it('shopping context 歸類到 entry.shopping', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-days/days?all=1'),
      env,
      params: { id: 'trip-days' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    const data = await resp.json() as Array<Record<string, unknown>>;

    const d1Timeline = data[0].timeline as Array<Record<string, unknown>>;
    const shopping = d1Timeline[0].shopping as Array<Record<string, unknown>>;
    expect(shopping).toHaveLength(1);
    expect(shopping[0].name).toBe('Day1 Shop');
    expect(shopping[0].mustBuy).toBe('紀念品');
  });

  it('entry travel fields 組成 travel 物件', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-days/days?all=1'),
      env,
      params: { id: 'trip-days' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    const data = await resp.json() as Array<Record<string, unknown>>;

    const d1Timeline = data[0].timeline as Array<Record<string, unknown>>;
    const travel = d1Timeline[0].travel as Record<string, unknown> | null;
    expect(travel).toEqual({ type: 'car', desc: '開車前往', min: 30 });

    // Day2 entry 沒設 travel → null
    const d2Timeline = data[1].timeline as Array<Record<string, unknown>>;
    expect(d2Timeline[0].travel).toBeNull();
  });

  it('Phase 3：entry.poi 取 POI master（取代舊 entry.location JSON）', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-days/days?all=1'),
      env,
      params: { id: 'trip-days' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    const data = await resp.json() as Array<Record<string, unknown>>;

    const d1Timeline = data[0].timeline as Array<Record<string, unknown>>;
    const poi = d1Timeline[0].poi as Record<string, unknown>;
    expect(poi).toBeTruthy();
    expect(poi.lat).toBe(26.5);
    expect(poi.lng).toBe(127.9);
    expect(poi.name).toBe('測試地點');
  });

  it('空行程（有天但無 POI）不 crash，回傳空 hotel/timeline', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-empty/days?all=1'),
      env,
      params: { id: 'trip-empty' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<Record<string, unknown>>;
    expect(data).toHaveLength(3);
    data.forEach(day => {
      expect(day.hotel).toBeNull();
      expect(day.timeline).toEqual([]);
    });
  });

  it('不存在的行程 → 空陣列', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/nope/days?all=1'),
      env,
      params: { id: 'nope' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    const data = await resp.json() as Array<unknown>;
    expect(data).toHaveLength(0);
  });

  it('batch 輸出與 single-day 端點每日資料完全一致（regression guard）', async () => {
    // Batch
    const batchCtx = mockContext({
      request: new Request('https://test.com/api/trips/trip-days/days?all=1'),
      env,
      params: { id: 'trip-days' },
    });
    const batchResp = await callHandler(onRequestGet, batchCtx);
    const batchData = await batchResp.json() as Array<Record<string, unknown>>;

    // Day 1 through 5 via single-day endpoint
    for (const dayNum of [1, 2, 3, 4, 5]) {
      const singleCtx = mockContext({
        request: new Request(`https://test.com/api/trips/trip-days/days/${dayNum}`),
        env,
        params: { id: 'trip-days', num: String(dayNum) },
      });
      const singleResp = await callHandler(onRequestGetSingle, singleCtx);
      const singleData = await singleResp.json() as Record<string, unknown>;
      const batchDay = batchData[dayNum - 1];

      // 深度比對（序列化後字串相等）確保 assembleDay 兩端產出完全一致
      expect(JSON.stringify(batchDay)).toBe(JSON.stringify(singleData));
    }
  });
});
