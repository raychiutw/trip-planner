/**
 * #1257 — 兩條已改接 entry intake 的路徑，各留一個 handler 層接線 case：
 * 走 onRequestPost 進、從 DB 驗「不變量真的套到了」。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockContext, mockAuth, seedUser, seedTrip, seedPoi, callHandler, jsonRequest } from './helpers';
import { onRequestPost as postEntry } from '../../functions/api/trips/[id]/days/[num]/entries';
import { onRequestPost as addToTrip } from '../../functions/api/poi-favorites/[id]/add-to-trip';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
const owner = 'intake-handlers@test.com';
const tripId = 'trip-intake-handlers';

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedUser(db, owner);
  await seedTrip(db, { id: tripId, owner, days: 1 });
});
afterAll(disposeMiniflare);

describe('POST /api/trips/:id/days/:num/entries → entry intake', () => {
  it('body.source 進 pois.source 與 trip_entries.source；note 進正選；version=1；audit 存在', async () => {
    const resp = await callHandler(postEntry, mockContext({
      request: jsonRequest(`https://test/api/trips/${tripId}/days/1/entries`, 'POST', {
        name: '接線景點', poi_type: 'attraction', lat: 26.2, lng: 127.7, source: 'custom', note: '  單筆備註  ', start_time: '09:00', end_time: '10:00',
      }),
      env, auth: mockAuth({ email: owner }), params: { id: tripId, num: '1' },
    }));
    expect(resp.status).toBe(201);
    const row = await resp.json() as { id: number; source: string; entryPoisVersion: number };
    expect(row.source).toBe('custom');
    expect(row.entryPoisVersion).toBe(1);
    const master = await db.prepare(
      'SELECT tep.note, p.source FROM trip_entry_pois tep JOIN pois p ON p.id = tep.poi_id WHERE tep.entry_id = ? AND tep.sort_order = 1',
    ).bind(row.id).first<{ note: string; source: string }>();
    expect(master).toEqual({ note: '單筆備註', source: 'custom' });
    const audit = await db.prepare("SELECT diff_json FROM audit_log WHERE table_name = 'trip_entries' AND record_id = ? AND action = 'insert'").bind(row.id).first<{ diff_json: string }>();
    expect(JSON.parse(audit!.diff_json)).toMatchObject({ day_num: 1, poiName: '接線景點' });
  });
});

describe('POST /api/poi-favorites/:id/add-to-trip → entry intake', () => {
  it('收藏 note 進正選（六條路徑中曾 silently 掉 note 的那條）；source=fast-path；audit 存在', async () => {
    const userId = await seedUser(db, owner);
    const poiId = await seedPoi(db, { name: '收藏景點', type: 'restaurant' });
    const fav = await db.prepare('INSERT INTO poi_favorites (user_id, poi_id, note) VALUES (?, ?, ?) RETURNING id')
      .bind(userId, poiId, '收藏的備註').first<{ id: number }>();
    const resp = await callHandler(addToTrip, mockContext({
      request: jsonRequest(`https://test/api/poi-favorites/${fav!.id}/add-to-trip`, 'POST', { tripId, dayNum: 1, startTime: '12:00', endTime: '13:00' }),
      env, auth: mockAuth({ email: owner }), params: { id: String(fav!.id) },
    }));
    expect(resp.status).toBe(201);
    const body = await resp.json() as { entryId: number };
    const e = await db.prepare('SELECT source, entry_pois_version FROM trip_entries WHERE id = ?').bind(body.entryId).first<{ source: string; entry_pois_version: number }>();
    expect(e).toEqual({ source: 'fast-path', entry_pois_version: 1 });
    const master = await db.prepare('SELECT poi_id, note FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1').bind(body.entryId).first<{ poi_id: number; note: string }>();
    expect(master).toEqual({ poi_id: poiId, note: '收藏的備註' });
    const audit = await db.prepare("SELECT 1 AS ok FROM audit_log WHERE table_name = 'trip_entries' AND record_id = ? AND action = 'insert'").bind(body.entryId).first();
    expect(audit).not.toBeNull();
  });
});
