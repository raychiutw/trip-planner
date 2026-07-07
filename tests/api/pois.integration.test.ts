/**
 * Integration test — PATCH /api/pois/:id
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedPoi, callHandler, seedTrip, seedEntry, getDayId } from './helpers';
import { onRequestPatch, onRequestDelete } from '../../functions/api/pois/[id]';
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
        // Migration 0045: rename google_rating → rating (1-7 OpenTripMap scale).
        rating: 4.5,
        address: '沖繩縣那霸市',
      }),
      env,
      auth: mockAuth({ email: 'service:poi-cli', userId: null, isServiceToken: true, scopes: ['ops:poi'], clientId: 'poi-cli' }),
      params: { id: String(poiId) },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(200);
    const poi = await db.prepare('SELECT rating, address FROM pois WHERE id = ?').bind(poiId).first();
    expect((poi as Record<string, unknown>).rating).toBe(4.5);
    expect((poi as Record<string, unknown>).address).toBe('沖繩縣那霸市');
  });

  it('非 admin 不帶 tripId → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}`, 'PATCH', { name: 'x' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: String(poiId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(400);
  });

  it('不存在 → 404', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/pois/99999', 'PATCH', { name: 'x' }),
      env,
      auth: mockAuth({ email: 'service:poi-cli', userId: null, isServiceToken: true, scopes: ['ops:poi'], clientId: 'poi-cli' }),
      params: { id: '99999' },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(404);
  });
});

describe('PATCH /api/pois/:id — tripId 權限', () => {
  const tripId = 'pois-perm-trip';
  const tripOwner = 'companion@test.com';

  beforeAll(async () => {
    await seedTrip(db, { id: tripId, owner: tripOwner });
    const dayId = await getDayId(db, tripId, 1);
    const entryId = await seedEntry(db, dayId);
    await db
      .prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)')
      .bind(entryId, poiId)
      .run();
  });

  it('帶 tripId + 有權限 + POI 屬於該 trip → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}`, 'PATCH', {
        tripId,
        lat: 26.3344,
        lng: 127.7731,
      }),
      env,
      auth: mockAuth({ email: tripOwner }),
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
      auth: mockAuth({ email: 'stranger@test.com' }),
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
      auth: mockAuth({ email: tripOwner }),
      params: { id: String(otherPoiId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(403);
  });

  // v2.29.0: 「舊 trip_pois timeline row 不授權」test removed — trip_pois table DROPPED。

  it('不帶 tripId + 非 admin → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}`, 'PATCH', {
        lat: 0,
      }),
      env,
      auth: mockAuth({ email: tripOwner }),
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
      auth: mockAuth({ email: 'service:poi-cli', userId: null, isServiceToken: true, scopes: ['ops:poi'], clientId: 'poi-cli' }),
      params: { id: String(poiId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(200);
  });
});

describe('PATCH /api/pois/:id — price (migration 0054)', () => {
  it('admin 更新 pois.price → 200 + DB 寫入', async () => {
    const restPoiId = await seedPoi(db, { type: 'restaurant', name: 'Price Test 拉麵' });
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${restPoiId}`, 'PATCH', {
        price: '¥800~1200',
      }),
      env,
      auth: mockAuth({ email: 'service:poi-cli', userId: null, isServiceToken: true, scopes: ['ops:poi'], clientId: 'poi-cli' }),
      params: { id: String(restPoiId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(200);
    const poi = await db.prepare('SELECT price FROM pois WHERE id = ?').bind(restPoiId).first();
    expect((poi as Record<string, unknown>).price).toBe('¥800~1200');
  });
});

// Round 4 fix adv-C1 / Codex F1 regression: migration 0057 adds trip_entry_pois with
// ON DELETE RESTRICT FK. Pre-fix, DELETE pois would 500 for any POI used as master/alt
// because trip_entry_pois junction rows blocked it. The fix prepends a DELETE FROM
// trip_entry_pois inside the admin POI delete handler.
describe('DELETE /api/pois/:id — v2.27.0 trip_entry_pois cleanup', () => {
  it('admin DELETE POI referenced as master in trip_entry_pois → succeeds + clears junction', async () => {
    const TRIP = 'trip-poi-del';
    await seedTrip(db, { id: TRIP });
    const dayId = await getDayId(db, TRIP, 1);
    const targetPoi = await seedPoi(db, { name: 'AdmDel-Master', type: 'attraction' });
    // v2.29.0: seedEntry({poiId}) 已自動 INSERT trip_entry_pois sort_order=1。
    const entryId = await seedEntry(db, dayId, { poiId: targetPoi });

    // Pre-condition: junction row exists
    const before = await db
      .prepare('SELECT COUNT(*) AS c FROM trip_entry_pois WHERE poi_id = ?')
      .bind(targetPoi)
      .first<{ c: number }>();
    expect(before!.c).toBe(1);

    const resp = await callHandler(onRequestDelete, mockContext({
      request: jsonRequest(`https://test.com/api/pois/${targetPoi}`, 'DELETE'),
      env,
      auth: mockAuth({ email: 'service:poi-cli', userId: null, isServiceToken: true, scopes: ['ops:poi'], clientId: 'poi-cli' }),
      params: { id: String(targetPoi) },
    }));
    expect(resp.status).toBe(200);
    // json() helper applies deepCamel — snake_case keys become camelCase in response
    const body = await resp.json() as { ok: boolean; deletedTripEntryPois: number };
    expect(body.ok).toBe(true);
    expect(body.deletedTripEntryPois).toBe(1);

    // Post-condition: POI gone + junction row gone
    const after = await db.prepare('SELECT id FROM pois WHERE id = ?').bind(targetPoi).first();
    expect(after).toBeNull();
    const junctionAfter = await db
      .prepare('SELECT COUNT(*) AS c FROM trip_entry_pois WHERE poi_id = ?')
      .bind(targetPoi)
      .first<{ c: number }>();
    expect(junctionAfter!.c).toBe(0);
  });

  it('admin DELETE POI referenced as alternate in trip_entry_pois → succeeds', async () => {
    const TRIP = 'trip-poi-del-alt';
    await seedTrip(db, { id: TRIP });
    const dayId = await getDayId(db, TRIP, 1);
    const masterPoi = await seedPoi(db, { name: 'AdmDel-Alt-M', type: 'attraction' });
    const altPoi = await seedPoi(db, { name: 'AdmDel-Alt-A', type: 'attraction' });
    // v2.29.0: seedEntry({poiId}) 已自動 INSERT master sort_order=1，只補 alternate。
    const entryId = await seedEntry(db, dayId, { poiId: masterPoi });
    await db
      .prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 2)')
      .bind(entryId, altPoi)
      .run();

    const resp = await callHandler(onRequestDelete, mockContext({
      request: jsonRequest(`https://test.com/api/pois/${altPoi}`, 'DELETE'),
      env,
      auth: mockAuth({ email: 'service:poi-cli', userId: null, isServiceToken: true, scopes: ['ops:poi'], clientId: 'poi-cli' }),
      params: { id: String(altPoi) },
    }));
    expect(resp.status).toBe(200);
    // Master row should survive
    const masterRow = await db
      .prepare('SELECT poi_id FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1')
      .bind(entryId)
      .first<{ poi_id: number }>();
    expect(masterRow!.poi_id).toBe(masterPoi);
  });
});
