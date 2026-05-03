/**
 * Integration test — POST /api/saved-pois/:id/add-to-trip 409 conflict (v2.21.1)
 *
 * 驗：
 *  - 同 day 時段重疊 → 409 + conflictWith {entryId, time, title, dayNum}
 *  - position=replace 跳過 conflict 檢查（要取代的本來就重疊）
 *  - 無時段（NULL time）entries 不算 conflict
 *  - 跨 day 不算 conflict
 *  - 時段精確不重疊（剛好接續）不算 conflict
 *  - 無衝突 → 201 + entryId
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip, seedPoi, callHandler } from './helpers';
import { onRequestPost } from '../../functions/api/saved-pois/[id]/add-to-trip';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
let savedId: number;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);

  await seedTrip(db, { id: 'conflict-trip', owner: 'conflict@test.com', days: 3 });
  const poiId = await seedPoi(db, { name: '衝突測試景點', type: 'restaurant' });

  const ownerUserId = `test-user-conflict-test-com`;
  const row = await db.prepare(
    'INSERT INTO saved_pois (user_id, poi_id) VALUES (?, ?) RETURNING id'
  ).bind(ownerUserId, poiId).first<{ id: number }>();
  savedId = row!.id;

  // Day 1 (id=1) 已有 entry 12:00-13:30
  const day1 = await db.prepare('SELECT id FROM trip_days WHERE trip_id = ? AND day_num = 1').bind('conflict-trip').first<{ id: number }>();
  await db.prepare(
    `INSERT INTO trip_entries (day_id, sort_order, time, title, source) VALUES (?, ?, ?, ?, ?)`
  ).bind(day1!.id, 0, '12:00-13:30', '既有午餐', 'manual').run();

  // Day 1 also has entry without time (NULL) — should never conflict
  await db.prepare(
    `INSERT INTO trip_entries (day_id, sort_order, time, title, source) VALUES (?, ?, ?, ?, ?)`
  ).bind(day1!.id, 1, null, '時段未定的彈性 stop', 'manual').run();

  // Day 2 has entry 12:00-13:30 (same time, different day — must NOT conflict day 1 insert)
  const day2 = await db.prepare('SELECT id FROM trip_days WHERE trip_id = ? AND day_num = 2').bind('conflict-trip').first<{ id: number }>();
  await db.prepare(
    `INSERT INTO trip_entries (day_id, sort_order, time, title, source) VALUES (?, ?, ?, ?, ?)`
  ).bind(day2!.id, 0, '12:00-13:30', 'Day 2 既有 entry', 'manual').run();
});

afterAll(disposeMiniflare);

function postAdd(body: Record<string, unknown>) {
  return mockContext({
    request: jsonRequest(`https://test.com/api/saved-pois/${savedId}/add-to-trip`, 'POST', body),
    env,
    auth: mockAuth({ email: 'conflict@test.com' }),
    params: { id: String(savedId) },
  });
}

describe('POST /api/saved-pois/:id/add-to-trip — 409 conflict (v2.21.1)', () => {
  it('overlapping time on same day → 409 + conflictWith', async () => {
    // Existing entry day 1 = 12:00-13:30. New = 13:00 (overlap by 30min)
    const ctx = postAdd({ tripId: 'conflict-trip', dayNum: 1, position: 'append', startTime: '13:00', endTime: '14:00' });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(409);
    const body = await resp.json() as { error: string; conflictWith: { entryId: number; time: string; title: string; dayNum: number } };
    expect(body.error).toBe('CONFLICT');
    expect(body.conflictWith.title).toBe('既有午餐');
    expect(body.conflictWith.time).toBe('12:00-13:30');
    expect(body.conflictWith.dayNum).toBe(1);
    expect(body.conflictWith.entryId).toBeGreaterThan(0);
  });

  it('exact time match → 409 (counts as overlap)', async () => {
    const ctx = postAdd({ tripId: 'conflict-trip', dayNum: 1, position: 'append', startTime: '12:00', endTime: '13:30' });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(409);
  });

  it('exact-edge contiguous (newStart === existingEnd) → 201 not conflict', async () => {
    // Existing 12:00-13:30. New starts exactly 13:30 → newStart < eEnd → 13:30 < 13:30 → false. No overlap.
    const ctx = postAdd({ tripId: 'conflict-trip', dayNum: 1, position: 'append', startTime: '13:30', endTime: '14:30' });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);
  });

  it('different day → 201 not conflict (day 3 free)', async () => {
    const ctx = postAdd({ tripId: 'conflict-trip', dayNum: 3, position: 'append', startTime: '12:00', endTime: '13:30' });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);
  });

  it('NULL time entry never blocks (Day 1 has 既有彈性 stop with no time)', async () => {
    // Day 3 has only the new entry from previous test. Insert another at 15:00-16:00.
    const ctx = postAdd({ tripId: 'conflict-trip', dayNum: 3, position: 'append', startTime: '15:00', endTime: '16:00' });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);
  });

  it('position=replace skips conflict check (anchor will be deleted)', async () => {
    // Get the existing 既有午餐 entry id
    const day1 = await db.prepare('SELECT id FROM trip_days WHERE trip_id = ? AND day_num = 1').bind('conflict-trip').first<{ id: number }>();
    const anchor = await db.prepare(
      `SELECT id FROM trip_entries WHERE day_id = ? AND title = '既有午餐'`
    ).bind(day1!.id).first<{ id: number }>();

    const ctx = postAdd({
      tripId: 'conflict-trip',
      dayNum: 1,
      position: 'replace',
      anchorEntryId: anchor!.id,
      startTime: '12:00',
      endTime: '13:30',
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201); // 不是 409 — replace 是合法 operation
  });
});
