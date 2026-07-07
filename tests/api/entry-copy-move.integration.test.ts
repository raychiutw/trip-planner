/**
 * Integration test — v2.10 Wave 1: Item 2 copy + Item 3 move（跨天）
 *
 * Item 2: POST /api/trips/:id/entries/:eid/copy
 * Item 3: PATCH /api/trips/:id/entries/:eid（day_id 加進 ALLOWED_FIELDS）
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip, seedEntry, seedPoi, getDayId, callHandler } from './helpers';
import { onRequestPost as onRequestPostCopy } from '../../functions/api/trips/[id]/entries/[eid]/copy';
import { onRequestPatch as onRequestPatchEntry } from '../../functions/api/trips/[id]/entries/[eid]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
let day1Id: number;
let day2Id: number;
let day3Id: number;
let entryDay1Id: number;
let masterPoiDay1Id: number;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-cm', days: 3 });
  // Seed second trip for cross-trip protection tests
  await seedTrip(db, { id: 'trip-other', days: 2 });
  day1Id = await getDayId(db, 'trip-cm', 1);
  day2Id = await getDayId(db, 'trip-cm', 2);
  day3Id = await getDayId(db, 'trip-cm', 3);
  // v2.29.0: trip_entries.time DROPPED；用 start_time/end_time 直接 UPDATE。
  // migration 0078: trip_entries.note DROPPED — 備註改掛 master trip_entry_pois.note。
  masterPoiDay1Id = await seedPoi(db, { name: '美ら海水族館', type: 'attraction' });
  entryDay1Id = await seedEntry(db, day1Id, { poiId: masterPoiDay1Id });
  await db.prepare('UPDATE trip_entries SET start_time = ?, end_time = ? WHERE id = ?')
    .bind('11:30', '14:00', entryDay1Id).run();
  // master poi 的 per-POI note（copy 時應隨 trip_entry_pois 複製過去）
  await db.prepare('UPDATE trip_entry_pois SET note = ? WHERE entry_id = ? AND sort_order = 1')
    .bind('mock note', entryDay1Id).run();
});

afterAll(disposeMiniflare);

describe('POST /api/trips/:id/entries/:eid/copy — Item 2', () => {
  it('複製 entry 到目標 day → 200 + 新 row + 原 entry 仍存在', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-cm/entries/${entryDay1Id}/copy`, 'POST', {
        targetDayId: day2Id,
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-cm', eid: String(entryDay1Id) },
    });
    const resp = await callHandler(onRequestPostCopy, ctx);
    expect(resp.status).toBe(200);
    const newRow = await resp.json() as Record<string, unknown>;
    // json() helper deep-camels keys: day_id → dayId, sort_order → sortOrder
    expect(newRow.dayId).toBe(day2Id);
    expect(Object.prototype.hasOwnProperty.call(newRow, 'title')).toBe(false);
    // v2.29.0: trip_entries.time DROPPED — 改驗 start_time / end_time
    expect(newRow.startTime).toBe('11:30');
    expect(newRow.endTime).toBe('14:00');
    expect(newRow.id).not.toBe(entryDay1Id);

    // migration 0078: entry-level note 已 DROP；per-POI note 隨 master trip_entry_pois 複製。
    const copiedMaster = await db
      .prepare('SELECT note FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1')
      .bind(newRow.id)
      .first<{ note: string | null }>();
    expect(copiedMaster!.note).toBe('mock note');

    // 原 entry 仍存在（copy 不是 move）
    const orig = await db.prepare('SELECT * FROM trip_entries WHERE id = ?').bind(entryDay1Id).first();
    expect(orig).toBeTruthy();

    // audit log 寫入 — action='insert' + diff 含 source ref
    const audit = await db.prepare("SELECT * FROM audit_log WHERE table_name='trip_entries' AND action='insert' AND record_id=?")
      .bind(newRow.id).first() as Record<string, unknown> | null;
    expect(audit).toBeTruthy();
    expect(audit?.diff_json as string).toContain('copiedFromEntryId');
  });

  it('targetDayId 屬於別 trip → 403', async () => {
    const otherDayId = await getDayId(db, 'trip-other', 1);
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-cm/entries/${entryDay1Id}/copy`, 'POST', {
        targetDayId: otherDayId,
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-cm', eid: String(entryDay1Id) },
    });
    expect((await callHandler(onRequestPostCopy, ctx)).status).toBe(403);
  });

  it('targetDayId 不存在 → 404', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-cm/entries/${entryDay1Id}/copy`, 'POST', {
        targetDayId: 99999,
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-cm', eid: String(entryDay1Id) },
    });
    expect((await callHandler(onRequestPostCopy, ctx)).status).toBe(404);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-cm/entries/${entryDay1Id}/copy`, 'POST', {
        targetDayId: day2Id,
      }),
      env,
      params: { id: 'trip-cm', eid: String(entryDay1Id) },
    });
    expect((await callHandler(onRequestPostCopy, ctx)).status).toBe(401);
  });

  it('targetDayId 非 number → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-cm/entries/${entryDay1Id}/copy`, 'POST', {
        targetDayId: 'abc',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-cm', eid: String(entryDay1Id) },
    });
    expect((await callHandler(onRequestPostCopy, ctx)).status).toBe(400);
  });

  it('sortOrder 不指定 → 自動追加到目標 day 末尾', async () => {
    // 在 day3 已有一筆 entry
    const existingEid = await seedEntry(db, day3Id, { sortOrder: 0 });
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-cm/entries/${entryDay1Id}/copy`, 'POST', {
        targetDayId: day3Id,
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-cm', eid: String(entryDay1Id) },
    });
    const resp = await callHandler(onRequestPostCopy, ctx);
    expect(resp.status).toBe(200);
    const newRow = await resp.json() as Record<string, unknown>;
    expect(newRow.sortOrder).toBe(1); // existingEid sortOrder 0 → new 1
    // cleanup
    await db.prepare('DELETE FROM trip_entries WHERE id IN (?, ?)').bind(existingEid, newRow.id).run();
  });
});

describe('PATCH /api/trips/:id/entries/:eid — Item 3 move 跨天 via day_id', () => {
  let movableEid: number;
  beforeAll(async () => {
    movableEid = await seedEntry(db, day1Id);
  });

  it('PATCH day_id → entry 搬到目標 day → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-cm/entries/${movableEid}`, 'PATCH', {
        day_id: day2Id,
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-cm', eid: String(movableEid) },
    });
    const resp = await callHandler(onRequestPatchEntry, ctx);
    expect(resp.status).toBe(200);
    const row = await db.prepare('SELECT day_id FROM trip_entries WHERE id = ?').bind(movableEid).first() as Record<string, unknown>;
    expect(row.day_id).toBe(day2Id);
  });

  it('PATCH day_id 屬於別 trip → 403', async () => {
    const otherDayId = await getDayId(db, 'trip-other', 1);
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-cm/entries/${movableEid}`, 'PATCH', {
        day_id: otherDayId,
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-cm', eid: String(movableEid) },
    });
    expect((await callHandler(onRequestPatchEntry, ctx)).status).toBe(403);
  });

  it('PATCH day_id 不存在 → 404', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-cm/entries/${movableEid}`, 'PATCH', {
        day_id: 99999,
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-cm', eid: String(movableEid) },
    });
    expect((await callHandler(onRequestPatchEntry, ctx)).status).toBe(404);
  });

  it('PATCH day_id 非 integer → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-cm/entries/${movableEid}`, 'PATCH', {
        day_id: 'abc',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-cm', eid: String(movableEid) },
    });
    expect((await callHandler(onRequestPatchEntry, ctx)).status).toBe(400);
  });
});
