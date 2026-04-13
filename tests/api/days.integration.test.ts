/**
 * Integration test — GET /api/trips/:id/days
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockContext, seedTrip, seedEntry, seedPoi, seedTripPoi, getDayId, callHandler } from './helpers';
import { onRequestGet } from '../../functions/api/trips/[id]/days';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-days', days: 5 });

  // Seed distinct POIs on day 1 and day 2 to verify cross-day isolation
  const d1Id = await getDayId(db, 'trip-days', 1);
  const d2Id = await getDayId(db, 'trip-days', 2);
  const d1EntryId = await seedEntry(db, d1Id, { title: 'Day1 Entry' });
  const d2EntryId = await seedEntry(db, d2Id, { title: 'Day2 Entry' });
  const d1PoiId = await seedPoi(db, { type: 'restaurant', name: 'Day1 Restaurant' });
  const d2PoiId = await seedPoi(db, { type: 'restaurant', name: 'Day2 Restaurant' });
  await seedTripPoi(db, { poiId: d1PoiId, tripId: 'trip-days', entryId: d1EntryId, dayId: d1Id });
  await seedTripPoi(db, { poiId: d2PoiId, tripId: 'trip-days', entryId: d2EntryId, dayId: d2Id });
});

afterAll(disposeMiniflare);

describe('GET /api/trips/:id/days', () => {
  it('列出所有天（summary 模式）', async () => {
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
    // summary 模式不含 timeline / hotel
    expect(data[0].timeline).toBeUndefined();
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

  it('?all=1 回傳完整 days 且 POI 不跨天洩漏', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-days/days?all=1'),
      env,
      params: { id: 'trip-days' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<Record<string, unknown>>;
    expect(data).toHaveLength(5);

    // Day 1: 只有 Day1 Restaurant，沒有 Day2 Restaurant
    const day1 = data[0];
    expect(day1.dayNum).toBe(1);
    const d1Timeline = day1.timeline as Array<Record<string, unknown>>;
    expect(d1Timeline).toHaveLength(1);
    expect(d1Timeline[0].title).toBe('Day1 Entry');
    const d1Rests = d1Timeline[0].restaurants as Array<Record<string, unknown>>;
    expect(d1Rests).toHaveLength(1);
    expect(d1Rests[0].name).toBe('Day1 Restaurant');
    expect(d1Rests.find(r => r.name === 'Day2 Restaurant')).toBeUndefined();

    // Day 2: 只有 Day2 Restaurant，沒有 Day1 Restaurant（驗證 tripPoisByDay 正確隔離）
    const day2 = data[1];
    expect(day2.dayNum).toBe(2);
    const d2Timeline = day2.timeline as Array<Record<string, unknown>>;
    expect(d2Timeline).toHaveLength(1);
    expect(d2Timeline[0].title).toBe('Day2 Entry');
    const d2Rests = d2Timeline[0].restaurants as Array<Record<string, unknown>>;
    expect(d2Rests).toHaveLength(1);
    expect(d2Rests[0].name).toBe('Day2 Restaurant');
    expect(d2Rests.find(r => r.name === 'Day1 Restaurant')).toBeUndefined();

    // Day 3-5: 空 timeline
    expect((data[2].timeline as unknown[])).toHaveLength(0);
    expect((data[3].timeline as unknown[])).toHaveLength(0);
    expect((data[4].timeline as unknown[])).toHaveLength(0);
  });

  it('?all=1 無資料的行程 → 空陣列', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/nope/days?all=1'),
      env,
      params: { id: 'nope' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    const data = await resp.json() as Array<unknown>;
    expect(data).toHaveLength(0);
  });
});
