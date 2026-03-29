/**
 * Integration test — GET/PUT /api/trips/:id/days/:num
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip, getDayId , callHandler } from './helpers';
import { onRequestGet, onRequestPut } from '../../functions/api/trips/[id]/days/[num]';
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
    expect(data.day_num).toBe(1);
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
});
