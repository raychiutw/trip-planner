/**
 * Integration test — PATCH/DELETE /api/trips/:id/entries/:eid
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip, seedEntry, seedPoi, getDayId , callHandler } from './helpers';
import { onRequestGet, onRequestPatch, onRequestDelete } from '../../functions/api/trips/[id]/entries/[eid]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
let entryId: number;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-e' });
  const dayId = await getDayId(db, 'trip-e', 1);
  const poiId = await seedPoi(db, { name: 'Original POI', type: 'attraction' });
  // v2.29.0: seedEntry poiId 已自動 INSERT trip_entry_pois sort_order=1（backward-compat）
  entryId = await seedEntry(db, dayId, { title: 'Original', poiId });
});

afterAll(disposeMiniflare);

describe('GET /api/trips/:id/entries/:eid', () => {
  it('回完整 entry shape（含 time/note/master/stopPois/entry_pois_version）→ 200', async () => {
    // v2.27.1 regression：v2.26.0 SELECT 只有 id/day_id/title，導致 EditEntryPage
    // 初始 load 後 entry.startTime/endTime/note/master 全 undefined → input 空白。
    // Backend SELECT 改 SELECT * 一勞永逸；此 test 鎖住完整 shape 防 regression。
    const ctx = mockContext({
      request: new Request(`https://test.com/api/trips/trip-e/entries/${entryId}`, { method: 'GET' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-e', eid: String(entryId) },
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    // json() helper does deepCamel — server SELECT day_id 出去變 dayId。
    const body = await resp.json() as {
      id: number | bigint;
      dayId: number | bigint;
      title: string;
      startTime?: string | null;
      endTime?: string | null;
      note?: string | null;
      master?: { poiId: number; name: string } | null;
      stopPois?: Array<{ poiId: number; sortOrder: number }>;
      alternates?: Array<{ poiId: number; sortOrder: number }>;
      entryPoisVersion?: number | string | null;
      sortOrder?: number;
    };
    expect(Number(body.id)).toBe(Number(entryId));
    expect(Number(body.dayId)).toBeGreaterThan(0);
    expect(body.title).toBeTruthy();
    // v2.29.0: trip_entries.{time, poi_id} DROPPED. start_time / end_time + note 必出現。
    expect('startTime' in body).toBe(true);
    expect('endTime' in body).toBe(true);
    expect('note' in body).toBe(true);
    expect('poiId' in body).toBe(false);
    expect('entryPoisVersion' in body).toBe(true);
    expect(body.master?.name).toBe('Original POI');
    expect(body.master?.poiId).toBeGreaterThan(0);
    expect(body.stopPois).toHaveLength(1);
    expect(body.stopPois?.[0]?.sortOrder).toBe(1);
    expect(body.alternates).toEqual([]);
    // seedEntry 寫 start_time='10:00'
    expect(body.startTime).toBe('10:00');
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: new Request(`https://test.com/api/trips/trip-e/entries/${entryId}`, { method: 'GET' }),
      env,
      params: { id: 'trip-e', eid: String(entryId) },
    });
    expect((await callHandler(onRequestGet, ctx)).status).toBe(401);
  });

  it('entry 不屬於該 trip → 404', async () => {
    await seedTrip(db, { id: 'trip-other' });
    const ctx = mockContext({
      request: new Request(`https://test.com/api/trips/trip-other/entries/${entryId}`, { method: 'GET' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-other', eid: String(entryId) },
    });
    expect((await callHandler(onRequestGet, ctx)).status).toBe(404);
  });

  it('entry id 不存在 → 404', async () => {
    const ctx = mockContext({
      request: new Request(`https://test.com/api/trips/trip-e/entries/999999`, { method: 'GET' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-e', eid: '999999' },
    });
    expect((await callHandler(onRequestGet, ctx)).status).toBe(404);
  });
});

describe('PATCH /api/trips/:id/entries/:eid', () => {
  it('更新 entry → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-e/entries/${entryId}`, 'PATCH', {
        title: 'Updated',
        note: 'some note',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-e', eid: String(entryId) },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(200);
    const row = await db.prepare('SELECT title, note FROM trip_entries WHERE id = ?').bind(entryId).first();
    expect((row as Record<string, unknown>).title).toBe('Updated');
    expect((row as Record<string, unknown>).note).toBe('some note');
  });

  it('缺 title → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-e/entries/${entryId}`, 'PATCH', {
        title: '',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-e', eid: String(entryId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(400);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-e/entries/${entryId}`, 'PATCH', { title: 'x' }),
      env,
      params: { id: 'trip-e', eid: String(entryId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(401);
  });

  // v2.26.0 (migration 0056) — start_time / end_time 拆分；v2.29.0 time col DROPPED。
  it('PATCH start_time + end_time → 寫入兩欄', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-e/entries/${entryId}`, 'PATCH', {
        start_time: '12:00',
        end_time: '13:30',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-e', eid: String(entryId) },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(200);
    const row = await db.prepare('SELECT start_time, end_time FROM trip_entries WHERE id = ?').bind(entryId).first();
    expect((row as Record<string, unknown>).start_time).toBe('12:00');
    expect((row as Record<string, unknown>).end_time).toBe('13:30');
  });

  it('PATCH 只給 start_time → end_time 從現值繼承', async () => {
    // 先設一個基礎 end_time
    await db.prepare('UPDATE trip_entries SET end_time = ? WHERE id = ?').bind('15:00', entryId).run();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-e/entries/${entryId}`, 'PATCH', {
        start_time: '14:00',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-e', eid: String(entryId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(200);
    const row = await db.prepare('SELECT start_time, end_time FROM trip_entries WHERE id = ?').bind(entryId).first();
    expect((row as Record<string, unknown>).start_time).toBe('14:00');
    expect((row as Record<string, unknown>).end_time).toBe('15:00');
  });

  it('PATCH legacy time "HH:MM-HH:MM" → parse 拆成 start_time / end_time', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-e/entries/${entryId}`, 'PATCH', {
        time: '09:30-10:45',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-e', eid: String(entryId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(200);
    const row = await db.prepare('SELECT start_time, end_time FROM trip_entries WHERE id = ?').bind(entryId).first();
    expect((row as Record<string, unknown>).start_time).toBe('09:30');
    expect((row as Record<string, unknown>).end_time).toBe('10:45');
  });

  it('PATCH legacy time "HH:MM" → start_time = HH:MM, end_time = NULL', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-e/entries/${entryId}`, 'PATCH', {
        time: '08:00',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-e', eid: String(entryId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(200);
    const row = await db.prepare('SELECT start_time, end_time FROM trip_entries WHERE id = ?').bind(entryId).first();
    expect((row as Record<string, unknown>).start_time).toBe('08:00');
    expect((row as Record<string, unknown>).end_time).toBeNull();
  });

  it('PATCH 無效 start_time format → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-e/entries/${entryId}`, 'PATCH', {
        start_time: '25:99',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-e', eid: String(entryId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(400);
  });

  it('PATCH start_time >= end_time → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-e/entries/${entryId}`, 'PATCH', {
        start_time: '14:00',
        end_time: '13:00',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-e', eid: String(entryId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(400);
  });

  it('PATCH 只給 start_time（晚於既有 end_time）→ effective merge 後 400', async () => {
    // 設 oldRow end_time = 13:30
    await db.prepare('UPDATE trip_entries SET start_time = ?, end_time = ? WHERE id = ?')
      .bind('12:00', '13:30', entryId).run();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-e/entries/${entryId}`, 'PATCH', {
        start_time: '15:00', // 比 oldRow.end_time(13:30) 晚 → inverted
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-e', eid: String(entryId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(400);

    // 沒被寫進去
    const row = await db.prepare('SELECT start_time FROM trip_entries WHERE id = ?').bind(entryId).first();
    expect((row as Record<string, unknown>).start_time).toBe('12:00');
  });
});

describe('DELETE /api/trips/:id/entries/:eid', () => {
  it('刪除 entry → 200', async () => {
    const dayId = await getDayId(db, 'trip-e', 2);
    const eid = await seedEntry(db, dayId, { title: 'ToDelete' });
    const ctx = mockContext({
      request: new Request(`https://test.com/api/trips/trip-e/entries/${eid}`, { method: 'DELETE', headers: { Origin: 'https://trip-planner-dby.pages.dev' } }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-e', eid: String(eid) },
    });
    const resp = await callHandler(onRequestDelete, ctx);
    expect(resp.status).toBe(200);
    const row = await db.prepare('SELECT * FROM trip_entries WHERE id = ?').bind(eid).first();
    expect(row).toBeNull();
  });
});
