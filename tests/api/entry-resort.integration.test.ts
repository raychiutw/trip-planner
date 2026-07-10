// @vitest-environment node
/**
 * resortDayByArrival — 依抵達時間（start_time）升冪重排某日 sort_order。
 *
 * 觸發於互動改時間 / 新增景點；手動拖曳與 bulk 建立不經過。這裡直接驗 helper 行為：
 * 亂序重排、已時序 no-op、無時間殿後 stable、同時間 stable、少於 2 筆略過。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { seedTrip, getDayId, mockEnv, mockAuth, mockContext, jsonRequest, callHandler } from './helpers';
import { resortDayByArrival } from '../../functions/api/_entry_sort';
import { onRequestPatch } from '../../functions/api/trips/[id]/entries/[eid]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;

beforeAll(async () => {
  db = await createTestDb();
  await seedTrip(db, { id: 'resort-trip', days: 8 });
}, 30000);

afterAll(disposeMiniflare);

/** 插入 entry，顯式指定 sort_order + start_time（null / '' 允許）。 */
async function ins(dayId: number, sortOrder: number, startTime: string | null): Promise<number> {
  const r = await db
    .prepare('INSERT INTO trip_entries (day_id, sort_order, start_time) VALUES (?, ?, ?) RETURNING id')
    .bind(dayId, sortOrder, startTime)
    .first<{ id: number }>();
  return r!.id;
}

async function idsInOrder(dayId: number): Promise<number[]> {
  const { results } = await db
    .prepare('SELECT id FROM trip_entries WHERE day_id = ? ORDER BY sort_order ASC')
    .bind(dayId)
    .all<{ id: number }>();
  return (results ?? []).map((r) => r.id);
}

describe('resortDayByArrival — 依抵達時間重排 sort_order', () => {
  it('亂序時間 → 依 start_time 升冪重排、sort_order 正規化為 0..N-1、回傳 true', async () => {
    const dayId = await getDayId(db, 'resort-trip', 1);
    const a = await ins(dayId, 0, '14:00');
    const b = await ins(dayId, 1, '09:00');
    const c = await ins(dayId, 2, '11:00');
    expect(await resortDayByArrival(db, dayId)).toBe(true);
    expect(await idsInOrder(dayId)).toEqual([b, c, a]); // 09 → 11 → 14
    const { results } = await db
      .prepare('SELECT sort_order FROM trip_entries WHERE day_id = ? ORDER BY sort_order ASC')
      .bind(dayId)
      .all<{ sort_order: number }>();
    expect((results ?? []).map((r) => r.sort_order)).toEqual([0, 1, 2]);
  });

  it('已是時序 → no-op、回傳 false', async () => {
    const dayId = await getDayId(db, 'resort-trip', 2);
    await ins(dayId, 0, '09:00');
    await ins(dayId, 1, '11:00');
    await ins(dayId, 2, '14:00');
    expect(await resortDayByArrival(db, dayId)).toBe(false);
  });

  it('無 start_time 者殿後、彼此保持原序（stable）', async () => {
    const dayId = await getDayId(db, 'resort-trip', 3);
    const u1 = await ins(dayId, 0, null);
    const t = await ins(dayId, 1, '10:00');
    const u2 = await ins(dayId, 2, null);
    expect(await resortDayByArrival(db, dayId)).toBe(true);
    expect(await idsInOrder(dayId)).toEqual([t, u1, u2]); // timed 先，untimed 尾端保持 u1<u2
  });

  it('同 start_time → 保持原相對順序（stable tiebreak）', async () => {
    const dayId = await getDayId(db, 'resort-trip', 4);
    const first = await ins(dayId, 0, '10:00');
    const second = await ins(dayId, 1, '10:00');
    const early = await ins(dayId, 2, '08:00');
    expect(await resortDayByArrival(db, dayId)).toBe(true);
    expect(await idsInOrder(dayId)).toEqual([early, first, second]); // 08 先；同 10:00 保持 first<second
  });

  it('少於 2 筆 → false', async () => {
    const dayId = await getDayId(db, 'resort-trip', 5);
    await ins(dayId, 0, '10:00');
    expect(await resortDayByArrival(db, dayId)).toBe(false);
  });

  it('空字串 start_time 視為無時間、殿後', async () => {
    const dayId = await getDayId(db, 'resort-trip', 6);
    const empty = await ins(dayId, 0, '');
    const timed = await ins(dayId, 1, '09:00');
    expect(await resortDayByArrival(db, dayId)).toBe(true);
    expect(await idsInOrder(dayId)).toEqual([timed, empty]);
  });

  // 回歸：混合 NULL 與 '' 的無時間列必須純靠 sort_order tiebreak。舊 SQL 次要鍵用 raw
  // start_time，SQLite 中 NULL < '' → NULL 列會浮到 '' 列上、蓋過 sort_order 保序（實測會 swap）。
  // NULLIF(start_time,'') 修正後：兩者都收斂成 NULL、落到 sort_order → 已依 sort_order 排 = no-op。
  it("混合 NULL 與 '' 的無時間列 → 純靠 sort_order 保序（不被 NULL<'' 打亂）", async () => {
    const dayId = await getDayId(db, 'resort-trip', 7);
    const timed = await ins(dayId, 0, '14:00');
    const emptyStr = await ins(dayId, 1, ''); // 無時間、sort_order 1（應在 NULL 列之前）
    const nullTime = await ins(dayId, 2, null); // 無時間、sort_order 2
    // timed 已在前、兩無時間列已依 sort_order 排 → no-op（舊 SQL 會誤 swap 成 [timed, nullTime, emptyStr]）
    expect(await resortDayByArrival(db, dayId)).toBe(false);
    expect(await idsInOrder(dayId)).toEqual([timed, emptyStr, nullTime]);
  });
});

describe('PATCH /entries/:eid resort guard — 端點層級：改 start_time 觸發、其他不觸發', () => {
  const TRIP = 'resort-ep-trip';
  let env: Env;

  beforeAll(async () => {
    env = mockEnv(db);
    await seedTrip(db, { id: TRIP, days: 4 });
  }, 30000);

  async function patch(eid: number, body: Record<string, unknown>) {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/${TRIP}/entries/${eid}`, 'PATCH', body),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: TRIP, eid: String(eid) },
    });
    return callHandler(onRequestPatch, ctx);
  }

  it('(a) PATCH { start_time } → 當日依抵達時間重排', async () => {
    const dayId = await getDayId(db, TRIP, 1);
    const e14 = await ins(dayId, 0, '14:00');
    const e09 = await ins(dayId, 1, '09:00');
    const e11 = await ins(dayId, 2, '11:00');
    const resp = await patch(e14, { start_time: '08:00' });
    expect(resp.status).toBe(200);
    expect(await idsInOrder(dayId)).toEqual([e14, e09, e11]); // 08:00 → 09:00 → 11:00
  });

  it('(b) PATCH { end_time } only → 不重排（亂序保持不變）', async () => {
    const dayId = await getDayId(db, TRIP, 2);
    const a = await ins(dayId, 0, '14:00'); // 故意亂序：14:00 在前
    const b = await ins(dayId, 1, '09:00');
    const before = await idsInOrder(dayId); // [a, b]
    const resp = await patch(a, { end_time: '23:00' });
    expect(resp.status).toBe(200);
    expect(await idsInOrder(dayId)).toEqual(before); // 只改 end_time → 不觸發重排
  });

  it('(c) PATCH { start_time, sort_order } → 顯式 sort_order 優先、跳過重排', async () => {
    const dayId = await getDayId(db, TRIP, 3);
    const a = await ins(dayId, 0, '14:00');
    const b = await ins(dayId, 1, '09:00');
    // a 改最早 00:01 但同時顯式 sort_order=5 → 若重排會排最前；跳過則依 sort_order 殿後。
    const resp = await patch(a, { start_time: '00:01', sort_order: 5 });
    expect(resp.status).toBe(200);
    const order = await idsInOrder(dayId);
    expect(order[order.length - 1]).toBe(a); // 尊重顯式 sort_order，未被重排到最前
    void b;
  });
});
