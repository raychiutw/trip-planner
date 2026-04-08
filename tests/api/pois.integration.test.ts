/**
 * Integration test — PATCH /api/pois/:id
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedPoi, callHandler, seedTrip, seedEntry, getDayId, seedTripPoi } from './helpers';
import { onRequestPatch } from '../../functions/api/pois/[id]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
let poiId: number;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  poiId = await seedPoi(db, { type: 'hotel', name: 'Test Hotel' });
});

afterAll(disposeMiniflare);

describe('PATCH /api/pois/:id', () => {
  it('admin 更新 POI → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}`, 'PATCH', {
        google_rating: 4.5,
        address: '沖繩縣那霸市',
      }),
      env,
      auth: mockAuth({ email: 'admin@test.com', isAdmin: true }),
      params: { id: String(poiId) },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(200);
    const poi = await db.prepare('SELECT google_rating, address FROM pois WHERE id = ?').bind(poiId).first();
    expect((poi as Record<string, unknown>).google_rating).toBe(4.5);
    expect((poi as Record<string, unknown>).address).toBe('沖繩縣那霸市');
  });

  it('非 admin 不帶 tripId → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}`, 'PATCH', { name: 'x' }),
      env,
      auth: mockAuth({ email: 'user@test.com', isAdmin: false }),
      params: { id: String(poiId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(400);
  });

  it('不存在 → 404', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/pois/99999', 'PATCH', { name: 'x' }),
      env,
      auth: mockAuth({ email: 'admin@test.com', isAdmin: true }),
      params: { id: '99999' },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(404);
  });
});

describe('PATCH /api/pois/:id — tripId 權限', () => {
  let tripPoiId: number;
  const tripId = 'pois-perm-trip';
  const tripOwner = 'companion@test.com';

  beforeAll(async () => {
    await seedTrip(db, { id: tripId, owner: tripOwner });
    const dayId = await getDayId(db, tripId, 1);
    const entryId = await seedEntry(db, dayId);
    tripPoiId = await seedTripPoi(db, { poiId: poiId, tripId, entryId, dayId });
  });

  it('帶 tripId + 有權限 + POI 屬於該 trip → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}`, 'PATCH', {
        tripId,
        lat: 26.3344,
        lng: 127.7731,
      }),
      env,
      auth: mockAuth({ email: tripOwner, isAdmin: false }),
      params: { id: String(poiId) },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(200);
    const poi = await db.prepare('SELECT lat, lng FROM pois WHERE id = ?').bind(poiId).first();
    expect((poi as Record<string, unknown>).lat).toBe(26.3344);
    expect((poi as Record<string, unknown>).lng).toBe(127.7731);
  });

  it('帶 tripId + 無權限 → 403', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}`, 'PATCH', {
        tripId,
        lat: 0,
      }),
      env,
      auth: mockAuth({ email: 'stranger@test.com', isAdmin: false }),
      params: { id: String(poiId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(403);
  });

  it('帶 tripId + POI 不屬於該 trip → 403', async () => {
    const otherPoiId = await seedPoi(db, { type: 'restaurant', name: 'Unlinked POI' });
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${otherPoiId}`, 'PATCH', {
        tripId,
        lat: 0,
      }),
      env,
      auth: mockAuth({ email: tripOwner, isAdmin: false }),
      params: { id: String(otherPoiId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(403);
  });

  it('不帶 tripId + 非 admin → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}`, 'PATCH', {
        lat: 0,
      }),
      env,
      auth: mockAuth({ email: tripOwner, isAdmin: false }),
      params: { id: String(poiId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(400);
  });

  it('不帶 tripId + admin → 200（向下相容）', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}`, 'PATCH', {
        address: '那霸市前島 2-3-1',
      }),
      env,
      auth: mockAuth({ email: 'admin@test.com', isAdmin: true }),
      params: { id: String(poiId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(200);
  });
});
