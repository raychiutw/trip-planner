/**
 * Integration test — PATCH /api/trips/:id/entries/batch
 *
 * Spec: openspec/changes/ideas-drag-to-itinerary/specs/drag-to-reorder/spec.md
 *   "Batch update 優化 D1 寫入" — 同 Day reorder 多 entries 時 SHALL 用單一
 *   transaction batch update，避免 N+1 write。drag drop 後一次送 5 entries。
 *
 * Field naming：spec 用 `order_in_day`，DB schema 用 `sort_order`。endpoint
 * 接 `sort_order`（一致 PATCH /entries/:eid 既有 contract）。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip, seedEntry, getDayId, callHandler } from './helpers';
import { onRequestPatch } from '../../functions/api/trips/[id]/entries/batch';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-batch' });
  await seedTrip(db, { id: 'trip-other' });
});

afterAll(disposeMiniflare);

describe('PATCH /api/trips/:id/entries/batch', () => {
  it('一次更新 5 entries 的 sort_order → 200，順序與 day_id 持久化', async () => {
    const dayId = await getDayId(db, 'trip-batch', 1);
    const ids = await Promise.all([
      seedEntry(db, dayId, { title: 'A', sortOrder: 0 }),
      seedEntry(db, dayId, { title: 'B', sortOrder: 1 }),
      seedEntry(db, dayId, { title: 'C', sortOrder: 2 }),
      seedEntry(db, dayId, { title: 'D', sortOrder: 3 }),
      seedEntry(db, dayId, { title: 'E', sortOrder: 4 }),
    ]);
    // 模擬 drag E 到頭：reorder 為 E A B C D
    const reordered = [ids[4], ids[0], ids[1], ids[2], ids[3]];
    const updates = reordered.map((id, idx) => ({ id, sort_order: idx }));

    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-batch/entries/batch', 'PATCH', { updates }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-batch' },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(200);

    const rows = await db.prepare('SELECT id, sort_order FROM trip_entries WHERE id IN (?, ?, ?, ?, ?) ORDER BY sort_order').bind(...reordered).all<{ id: number; sort_order: number }>();
    expect(rows.results.map((r) => r.id)).toEqual(reordered);
  });

  it('Cross-day move：同次 batch 更新 day_id + sort_order', async () => {
    const day1 = await getDayId(db, 'trip-batch', 2);
    const day2 = await getDayId(db, 'trip-batch', 3);
    const eid = await seedEntry(db, day1, { title: 'Movable', sortOrder: 0 });
    const updates = [{ id: eid, day_id: day2, sort_order: 99 }];

    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-batch/entries/batch', 'PATCH', { updates }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-batch' },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(200);

    const row = await db.prepare('SELECT day_id, sort_order FROM trip_entries WHERE id = ?').bind(eid).first<{ day_id: number; sort_order: number }>();
    expect(row?.day_id).toBe(day2);
    expect(row?.sort_order).toBe(99);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-batch/entries/batch', 'PATCH', { updates: [] }),
      env,
      params: { id: 'trip-batch' },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(401);
  });

  it('無 trip 權限 → 403', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-batch/entries/batch', 'PATCH', { updates: [] }),
      env,
      auth: mockAuth({ email: 'stranger@test.com' }),
      params: { id: 'trip-batch' },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(403);
  });

  it('updates 內有不屬於該 trip 的 entry → 404 atomically，原 entry 不被改', async () => {
    const dayId = await getDayId(db, 'trip-batch', 1);
    const otherDayId = await getDayId(db, 'trip-other', 1);
    const myEntry = await seedEntry(db, dayId, { title: 'Mine', sortOrder: 50 });
    const otherEntry = await seedEntry(db, otherDayId, { title: 'NotMine', sortOrder: 50 });

    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-batch/entries/batch', 'PATCH', {
        updates: [
          { id: myEntry, sort_order: 999 },
          { id: otherEntry, sort_order: 999 },
        ],
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-batch' },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(404);
    // myEntry 不應被修改 — 整 batch atomic 失敗
    const row = await db.prepare('SELECT sort_order FROM trip_entries WHERE id = ?').bind(myEntry).first<{ sort_order: number }>();
    expect(row?.sort_order).toBe(50);
  });

  it('day_id 屬於別 trip → 403', async () => {
    const dayId = await getDayId(db, 'trip-batch', 1);
    const otherDayId = await getDayId(db, 'trip-other', 1);
    const eid = await seedEntry(db, dayId, { title: 'X', sortOrder: 60 });

    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-batch/entries/batch', 'PATCH', {
        updates: [{ id: eid, day_id: otherDayId }],
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-batch' },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(403);
  });

  it('updates 為空 → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-batch/entries/batch', 'PATCH', { updates: [] }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-batch' },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(400);
  });

  it('updates 缺 id → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-batch/entries/batch', 'PATCH', {
        updates: [{ sort_order: 1 }],
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-batch' },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(400);
  });
});
