/**
 * v2.33.8 — POST /api/trips/:id/days/shift integration tests
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockContext, mockAuth, seedTrip, callHandler, jsonRequest } from './helpers';
import { onRequestPost } from '../../functions/api/trips/[id]/days/shift';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
});
afterAll(disposeMiniflare);

describe('POST /api/trips/:id/days/shift', () => {
  it('5 天 trip shift 全變 + day_of_week 重算', async () => {
    await seedTrip(db, { id: 'shift-trip', days: 5 });
    // Original: 4/1 - 4/5 (5 days)
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/shift-trip/days/shift', 'POST', {
        startDate: '2026-08-15',
      }),
      env,
      auth: mockAuth(),
      params: { id: 'shift-trip' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);
    const body = await resp.json() as { ok: boolean; newStartDate: string; newEndDate: string; daysShifted: number };
    expect(body.ok).toBe(true);
    expect(body.newStartDate).toBe('2026-08-15');
    expect(body.newEndDate).toBe('2026-08-19');
    expect(body.daysShifted).toBe(5);

    const { results } = await db
      .prepare('SELECT day_num, date, day_of_week FROM trip_days WHERE trip_id = ? ORDER BY day_num ASC')
      .bind('shift-trip')
      .all() as { results: Array<{ day_num: number; date: string; day_of_week: string }> };
    expect(results.map((r) => r.date)).toEqual([
      '2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19',
    ]);
    expect(results.map((r) => r.day_of_week)).toEqual(['六', '日', '一', '二', '三']);
  });

  it('gap preservation — 中間 day 已刪後，shift 仍保留 gap', async () => {
    await seedTrip(db, { id: 'shift-gap', days: 4 });
    // Original: 4/1, 4/2, 4/3, 4/4
    // Manually create gap: skip day_num=2's date sequence
    await db.prepare('UPDATE trip_days SET date = ? WHERE trip_id = ? AND day_num = 3')
      .bind('2026-04-05', 'shift-gap').run(); // gap at 4/4 vs current 4/5
    await db.prepare('UPDATE trip_days SET date = ? WHERE trip_id = ? AND day_num = 4')
      .bind('2026-04-06', 'shift-gap').run();
    // Now: Day1=4/1, Day2=4/2, Day3=4/5 (gap 4/3, 4/4), Day4=4/6

    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/shift-gap/days/shift', 'POST', {
        startDate: '2026-06-10',
      }),
      env,
      auth: mockAuth(),
      params: { id: 'shift-gap' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);
    const { results } = await db
      .prepare('SELECT day_num, date FROM trip_days WHERE trip_id = ? ORDER BY day_num ASC')
      .bind('shift-gap')
      .all() as { results: Array<{ day_num: number; date: string }> };
    // delta = 6/10 - 4/1 = +70 days
    // Day 1: 4/1 + 70 = 6/10
    // Day 2: 4/2 + 70 = 6/11
    // Day 3: 4/5 + 70 = 6/14 (gap preserved)
    // Day 4: 4/6 + 70 = 6/15
    expect(results.map((r) => r.date)).toEqual([
      '2026-06-10', '2026-06-11', '2026-06-14', '2026-06-15',
    ]);
  });

  it('startDate 同舊 Day 1 → no-op delta=0', async () => {
    await seedTrip(db, { id: 'shift-noop', days: 2 });
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/shift-noop/days/shift', 'POST', {
        startDate: '2026-04-01',
      }),
      env,
      auth: mockAuth(),
      params: { id: 'shift-noop' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);
    const body = await resp.json() as { daysShifted: number };
    expect(body.daysShifted).toBe(0);
  });

  it('Invalid date 格式 → 400', async () => {
    await seedTrip(db, { id: 'shift-bad', days: 1 });
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/shift-bad/days/shift', 'POST', {
        startDate: 'not-a-date',
      }),
      env,
      auth: mockAuth(),
      params: { id: 'shift-bad' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
  });

  it('未登入 → 401', async () => {
    await seedTrip(db, { id: 'shift-auth', days: 1 });
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/shift-auth/days/shift', 'POST', { startDate: '2026-05-01' }),
      env,
      params: { id: 'shift-auth' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(401);
  });

  it('非 owner → 403', async () => {
    await seedTrip(db, { id: 'shift-perm', days: 1, owner: 'owner@test.com' });
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/shift-perm/days/shift', 'POST', { startDate: '2026-05-01' }),
      env,
      auth: mockAuth({ email: 'other@test.com' }),
      params: { id: 'shift-perm' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(403);
  });
});
