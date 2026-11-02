// @vitest-environment node
/**
 * resortDayByArrival — 依抵達時間（start_time）升冪重排某日 sort_order（module 測試）。
 * 端點層級（PATCH /entries/:eid 何時觸發重排）在 tests/api/entry-resort.integration.test.ts。
 *
 * 觸發於互動改時間 / 新增景點；手動拖曳與 bulk 建立不經過。這裡直接驗 helper 行為：
 * 亂序重排、已時序 no-op、無時間殿後 stable、同時間 stable、少於 2 筆略過。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from '../api/setup';
import { seedTrip, getDayId } from '../api/helpers';
import { resortDayByArrival } from '../../functions/api/_entry_sort';

let db: D1Database;
const tripIds: string[] = [];

beforeAll(async () => {
  db = await createTestDb();
  tripIds.push('resort-trip');
  await seedTrip(db, { id: 'resort-trip', days: 8 });
}, 30000);

afterAll(async () => {
  // 共用 D1：只清自己建立的行程（days / entries 走 FK cascade，permissions 要手動清）
  for (const id of tripIds) {
    await db.prepare('DELETE FROM trip_permissions WHERE trip_id = ?').bind(id).run(); // 無 FK cascade
    await db.prepare('DELETE FROM trips WHERE id = ?').bind(id).run();
  }
  await disposeMiniflare();
});

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

  it('同 start_time 且 id 順序與 sort_order 相反 → 依 sort_order 決定（不是靠插入／id 順序）', async () => {
    // 其他案例的 id 順序剛好等於 sort_order 順序，SQLite 預設的穩定掃描就會蓋過 tiebreak，抓不到它被拿掉
    const dayId = await getDayId(db, 'resort-trip', 8);
    const laterInserted = await ins(dayId, 5, '10:00'); // 先插入、id 較小，但 sort_order 較大
    const earlierInserted = await ins(dayId, 2, '10:00'); // 後插入、id 較大，但 sort_order 較小
    await resortDayByArrival(db, dayId);
    expect(await idsInOrder(dayId)).toEqual([earlierInserted, laterInserted]);
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
