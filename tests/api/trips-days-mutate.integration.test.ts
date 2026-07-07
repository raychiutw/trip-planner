/**
 * Integration test — v2.33.0 POST /api/trips/:id/days + DELETE /api/trips/:id/days/:num
 *
 * 涵蓋：
 * - POST append: new day_num = max+1, date = max+1d
 * - POST prepend: 所有 day_num+1, INSERT day_num=1 + date = min-1d
 * - DELETE middle: cascade entries + 後續 day_num/date 上移
 * - DELETE 最後一天禁止
 * - 無權限 → PERM_DENIED
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockContext, mockAuth, seedTrip, seedEntry, getDayId, callHandler, jsonRequest } from './helpers';
import { onRequestPost } from '../../functions/api/trips/[id]/days';
import { onRequestDelete } from '../../functions/api/trips/[id]/days/[num]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
});

afterAll(disposeMiniflare);

describe('POST /api/trips/:id/days — append (position=end)', () => {
  it('append 新天，day_num 接續最大值，date 順延 1 天', async () => {
    await seedTrip(db, { id: 'append-trip', days: 3 });
    // seedTrip 預設 date '2026-04-01', '2026-04-02', '2026-04-03'

    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/append-trip/days', 'POST', { position: 'end' }),
      env,
      auth: mockAuth(),
      params: { id: 'append-trip' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);
    const body = await resp.json() as { day: { dayNum: number; date: string; dayOfWeek: string } };
    expect(body.day.dayNum).toBe(4);
    expect(body.day.date).toBe('2026-04-04');
    expect(body.day.dayOfWeek).toBe('六'); // 2026-04-04 是週六

    // DB 確認共 4 天
    const { results } = await db
      .prepare('SELECT day_num, date FROM trip_days WHERE trip_id = ? ORDER BY day_num ASC')
      .bind('append-trip')
      .all();
    expect(results).toHaveLength(4);
  });
});

describe('POST /api/trips/:id/days — prepend (position=start)', () => {
  it('prepend 新天，現有 day_num 全 +1，新 day_num=1 + date 提前 1 天', async () => {
    await seedTrip(db, { id: 'prepend-trip', days: 3 });

    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/prepend-trip/days', 'POST', { position: 'start' }),
      env,
      auth: mockAuth(),
      params: { id: 'prepend-trip' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);
    const body = await resp.json() as { day: { dayNum: number; date: string } };
    expect(body.day.dayNum).toBe(1);
    expect(body.day.date).toBe('2026-03-31'); // 2026-04-01 前一天

    // DB 確認 4 天：day_num 1-4
    const { results } = await db
      .prepare('SELECT day_num, date FROM trip_days WHERE trip_id = ? ORDER BY day_num ASC')
      .bind('prepend-trip')
      .all() as { results: Array<{ day_num: number; date: string }> };
    expect(results).toHaveLength(4);
    expect(results[0].day_num).toBe(1);
    expect(results[0].date).toBe('2026-03-31');
    expect(results[1].day_num).toBe(2);
    expect(results[1].date).toBe('2026-04-01'); // 原 day 1 變 day 2
  });
});

describe('POST /api/trips/:id/days — insert (position=insert, v2.33.7 fill gap)', () => {
  it('insert middle date → 找對應 day_num，後續 days day_num +1', async () => {
    await seedTrip(db, { id: 'insert-trip', days: 3 });
    // Original: Day 1=4/1, Day 2=4/2, Day 3=4/3
    // Delete Day 2 (mid) 留 gap 4/2 → 剩 Day 1=4/1, Day 2=4/3 (renumbered)
    const ctxDel = mockContext({
      request: jsonRequest('https://test.com/api/trips/insert-trip/days/2', 'DELETE'),
      env,
      auth: mockAuth(),
      params: { id: 'insert-trip', num: '2' },
    });
    await callHandler((await import('../../functions/api/trips/[id]/days/[num]')).onRequestDelete, ctxDel);

    // Now insert 4/2 back
    const ctxIns = mockContext({
      request: jsonRequest('https://test.com/api/trips/insert-trip/days', 'POST', {
        position: 'insert',
        date: '2026-04-02',
      }),
      env,
      auth: mockAuth(),
      params: { id: 'insert-trip' },
    });
    const resp = await callHandler(onRequestPost, ctxIns);
    expect(resp.status).toBe(200);
    const body = await resp.json() as { day: { dayNum: number; date: string; dayOfWeek: string } };
    expect(body.day.date).toBe('2026-04-02');
    expect(body.day.dayNum).toBe(2);

    // DB 確認 3 天 day_num 1-3 contiguous dates
    const { results } = await db
      .prepare('SELECT day_num, date FROM trip_days WHERE trip_id = ? ORDER BY day_num ASC')
      .bind('insert-trip')
      .all() as { results: Array<{ day_num: number; date: string }> };
    expect(results.map((r) => r.day_num)).toEqual([1, 2, 3]);
    expect(results.map((r) => r.date)).toEqual(['2026-04-01', '2026-04-02', '2026-04-03']);
  });

  it('insert date 已存在 → 400', async () => {
    await seedTrip(db, { id: 'insert-dup', days: 3 });
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/insert-dup/days', 'POST', {
        position: 'insert',
        date: '2026-04-02', // 已存在
      }),
      env,
      auth: mockAuth(),
      params: { id: 'insert-dup' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
  });

  it('insert without date → 400', async () => {
    await seedTrip(db, { id: 'insert-nodate', days: 1 });
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/insert-nodate/days', 'POST', {
        position: 'insert',
      }),
      env,
      auth: mockAuth(),
      params: { id: 'insert-nodate' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
  });
});

describe('POST /api/trips/:id/days — validation', () => {
  it('body 沒 position → 400', async () => {
    await seedTrip(db, { id: 'val-trip', days: 1 });
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/val-trip/days', 'POST', {}),
      env,
      auth: mockAuth(),
      params: { id: 'val-trip' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
  });

  it('未登入 → 401', async () => {
    await seedTrip(db, { id: 'auth-trip', days: 1 });
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/auth-trip/days', 'POST', { position: 'end' }),
      env,
      // no auth
      params: { id: 'auth-trip' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(401);
  });

  it('非 owner → 403', async () => {
    await seedTrip(db, { id: 'perm-trip', days: 1, owner: 'owner@test.com' });
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/perm-trip/days', 'POST', { position: 'end' }),
      env,
      auth: mockAuth({ email: 'other@test.com' }),
      params: { id: 'perm-trip' },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(403);
  });
});

describe('DELETE /api/trips/:id/days/:num — middle day cascade (v2.33.1: preserve dates)', () => {
  it('刪除中間天，cascade entries + 後續 day_num 上移；dates 保留（會留 gap）', async () => {
    await seedTrip(db, { id: 'del-mid', days: 5 });
    const d3Id = await getDayId(db, 'del-mid', 3);
    await seedEntry(db, d3Id, { sortOrder: 0 });
    await seedEntry(db, d3Id, { sortOrder: 1 });

    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/del-mid/days/3', 'DELETE'),
      env,
      auth: mockAuth(),
      params: { id: 'del-mid', num: '3' },
    });
    const resp = await callHandler(onRequestDelete, ctx);
    expect(resp.status).toBe(200);
    const body = await resp.json() as { ok: boolean; removedEntryCount: number };
    expect(body.ok).toBe(true);
    expect(body.removedEntryCount).toBe(2);

    // v2.33.1: 剩 4 天，day_num 1-4，dates 保留（Day 3=5/3 跳過，Day 3 變 5/4 原值）。
    // 違反 contiguous 但保 user 意圖：「Day 3 那天我刪掉了，不要影響其他天的日期」
    const { results } = await db
      .prepare('SELECT day_num, date FROM trip_days WHERE trip_id = ? ORDER BY day_num ASC')
      .bind('del-mid')
      .all() as { results: Array<{ day_num: number; date: string }> };
    expect(results).toHaveLength(4);
    expect(results.map((r) => r.day_num)).toEqual([1, 2, 3, 4]);
    // dates 不再 contiguous — Day 3 (was 4/3) 已刪，原 Day 4 (4/4) → Day 3，date 保留 4/4
    expect(results.map((r) => r.date)).toEqual(['2026-04-01', '2026-04-02', '2026-04-04', '2026-04-05']);
    const entryRows = await db.prepare('SELECT id FROM trip_entries WHERE day_id = ?').bind(d3Id).all();
    expect(entryRows.results).toHaveLength(0);
  });

  it('刪除第一天（prepend / delete-first 對稱）— 剩餘 dates 保留', async () => {
    await seedTrip(db, { id: 'del-first', days: 3 });
    // Original: Day 1=4/1, Day 2=4/2, Day 3=4/3
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/del-first/days/1', 'DELETE'),
      env,
      auth: mockAuth(),
      params: { id: 'del-first', num: '1' },
    });
    const resp = await callHandler(onRequestDelete, ctx);
    expect(resp.status).toBe(200);
    const { results } = await db
      .prepare('SELECT day_num, date FROM trip_days WHERE trip_id = ? ORDER BY day_num ASC')
      .bind('del-first')
      .all() as { results: Array<{ day_num: number; date: string }> };
    expect(results.map((r) => r.day_num)).toEqual([1, 2]);
    expect(results.map((r) => r.date)).toEqual(['2026-04-02', '2026-04-03']);
  });
});

describe('DELETE /api/trips/:id/days/:num — last-day guard', () => {
  it('行程只剩 1 天時禁止刪除', async () => {
    await seedTrip(db, { id: 'last-day', days: 1 });
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/last-day/days/1', 'DELETE'),
      env,
      auth: mockAuth(),
      params: { id: 'last-day', num: '1' },
    });
    const resp = await callHandler(onRequestDelete, ctx);
    expect(resp.status).toBe(400);
  });

  it('刪除不存在的 day → 404', async () => {
    await seedTrip(db, { id: 'del-404', days: 3 });
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/del-404/days/99', 'DELETE'),
      env,
      auth: mockAuth(),
      params: { id: 'del-404', num: '99' },
    });
    const resp = await callHandler(onRequestDelete, ctx);
    expect(resp.status).toBe(404);
  });

  it('非 owner → 403', async () => {
    await seedTrip(db, { id: 'del-perm', days: 3, owner: 'owner@test.com' });
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/del-perm/days/2', 'DELETE'),
      env,
      auth: mockAuth({ email: 'other@test.com' }),
      params: { id: 'del-perm', num: '2' },
    });
    const resp = await callHandler(onRequestDelete, ctx);
    expect(resp.status).toBe(403);
  });
});
