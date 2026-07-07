/**
 * Integration test — GET /api/trips/:id/segments
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, seedTrip, getDayId, callHandler, seedEntry } from './helpers';
import { onRequestGet } from '../../functions/api/trips/[id]/segments/index';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
let entry1: number, entry2: number, entry3: number;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  // published: 0 — v2.33.41 published trips allow anonymous read; test
  // 401/403 cases require non-published trip。
  await seedTrip(db, { id: 'trip-seg-get', published: 0 });
  const day1 = await getDayId(db, 'trip-seg-get', 1);
  entry1 = await seedEntry(db, day1, { sortOrder: 1 });
  entry2 = await seedEntry(db, day1, { sortOrder: 2 });
  entry3 = await seedEntry(db, day1, { sortOrder: 3 });

  const now = Date.now();
  await db.prepare(
    `INSERT INTO trip_segments
     (trip_id, from_entry_id, to_entry_id, mode, min, distance_m, source, computed_at, updated_at)
     VALUES (?, ?, ?, 'walking', 5, 400, 'google', ?, ?)`,
  ).bind('trip-seg-get', entry1, entry2, now, now).run();
  await db.prepare(
    `INSERT INTO trip_segments
     (trip_id, from_entry_id, to_entry_id, mode, min, distance_m, source, computed_at, updated_at)
     VALUES (?, ?, ?, 'driving', 25, 18000, 'google', ?, ?)`,
  ).bind('trip-seg-get', entry2, entry3, now, now).run();
});

afterAll(disposeMiniflare);

describe('GET /api/trips/:id/segments', () => {
  it('回 array of segments by day order → 200', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-seg-get/segments', { method: 'GET' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-seg-get' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    // json() helper deepCamel: snake_case → camelCase
    const body = await resp.json() as Array<{ mode: string; min: number; distanceM: number; fromEntryId: number; toEntryId: number }>;
    expect(body).toHaveLength(2);
    expect(body[0].mode).toBe('walking');
    expect(body[0].fromEntryId).toBe(entry1);
    expect(body[0].toEntryId).toBe(entry2);
    expect(body[1].mode).toBe('driving');
    expect(body[1].distanceM).toBe(18000);
  });

  it('未認證 → 403（v2.33.41 requireTripReadAccess 對 anon + 非 published 統一回 PERM_DENIED）', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-seg-get/segments', { method: 'GET' }),
      env,
      params: { id: 'trip-seg-get' },
    });
    expect((await callHandler(onRequestGet, ctx)).status).toBe(403);
  });

  it('沒權限 → 403', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-seg-get/segments', { method: 'GET' }),
      env,
      auth: mockAuth({ email: 'other@test.com' }),
      params: { id: 'trip-seg-get' },
    });
    expect((await callHandler(onRequestGet, ctx)).status).toBe(403);
  });

  it('trip 無 segment → 200 + []', async () => {
    await seedTrip(db, { id: 'trip-empty-seg', published: 0 });
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-empty-seg/segments', { method: 'GET' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-empty-seg' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual([]);
  });
});
