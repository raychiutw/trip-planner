/**
 * Integration test — POST /trip-pois (via entries) + PATCH/DELETE /trip-pois/:tpid
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip, seedEntry, getDayId , callHandler } from './helpers';
import { onRequestPost } from '../../functions/api/trips/[id]/entries/[eid]/trip-pois';
import { onRequestPatch, onRequestDelete } from '../../functions/api/trips/[id]/trip-pois/[tpid]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
let entryId: number;
let tripPoiId: number;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-tp' });
  const dayId = await getDayId(db, 'trip-tp', 1);
  entryId = await seedEntry(db, dayId);
});

afterAll(disposeMiniflare);

describe('POST /api/trips/:id/entries/:eid/trip-pois', () => {
  it('新增 POI 到 entry → 201', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-tp/entries/${entryId}/trip-pois`, 'POST', {
        name: 'すし三昧',
        type: 'restaurant',
        context: 'timeline',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-tp', eid: String(entryId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);
    const data = await resp.json() as Record<string, unknown>;
    tripPoiId = data.id as number;
    expect(data.poiId).toBeDefined();

    // 驗證 pois master 已建立
    const poi = await db.prepare('SELECT * FROM pois WHERE name = ?').bind('すし三昧').first();
    expect(poi).not.toBeNull();
  });

  it('缺 name → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-tp/entries/${entryId}/trip-pois`, 'POST', {
        type: 'restaurant',
        context: 'timeline',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-tp', eid: String(entryId) },
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(400);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-tp/entries/${entryId}/trip-pois`, 'POST', {
        name: 'x', type: 'restaurant', context: 'timeline',
      }),
      env,
      params: { id: 'trip-tp', eid: String(entryId) },
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(401);
  });

  it('帶 price → 寫入 pois.price 不寫 trip_pois.price (migration 0054)', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-tp/entries/${entryId}/trip-pois`, 'POST', {
        name: '價位測試屋',
        type: 'restaurant',
        context: 'timeline',
        price: '¥600~',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-tp', eid: String(entryId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);
    const data = await resp.json() as Record<string, unknown>;
    const poiIdRow = (data.poi_id ?? data.poiId) as number;

    const poi = await db.prepare('SELECT price FROM pois WHERE id = ?').bind(poiIdRow).first();
    expect((poi as Record<string, unknown>).price).toBe('¥600~');

    const tp = await db.prepare('SELECT price FROM trip_pois WHERE id = ?').bind(data.id).first();
    expect((tp as Record<string, unknown>).price).toBeNull();
  });
});

describe('PATCH /api/trips/:id/trip-pois/:tpid', () => {
  it('更新 trip_pois → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-tp/trip-pois/${tripPoiId}`, 'PATCH', {
        note: 'must try',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-tp', tpid: String(tripPoiId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(200);
  });

  it('PATCH price → dispatch 到 pois master (migration 0054)', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-tp/trip-pois/${tripPoiId}`, 'PATCH', {
        price: '¥1000~1500',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-tp', tpid: String(tripPoiId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(200);

    const tp = await db.prepare('SELECT poi_id FROM trip_pois WHERE id = ?').bind(tripPoiId).first();
    const poi = await db.prepare('SELECT price FROM pois WHERE id = ?').bind((tp as Record<string, unknown>).poi_id).first();
    expect((poi as Record<string, unknown>).price).toBe('¥1000~1500');
  });
});

describe('DELETE /api/trips/:id/trip-pois/:tpid', () => {
  it('刪除 trip_pois → 200', async () => {
    const ctx = mockContext({
      request: new Request(`https://test.com/api/trips/trip-tp/trip-pois/${tripPoiId}`, {
        method: 'DELETE',
        headers: { Origin: 'https://trip-planner-dby.pages.dev' },
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-tp', tpid: String(tripPoiId) },
    });
    expect((await callHandler(onRequestDelete, ctx)).status).toBe(200);
  });
});
