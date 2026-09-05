/**
 * #1257 entry intake —— 「建立 entry + 掛正選 POI」的單一 seam。
 * 六個不變量都從 createEntry 這個 interface 驗，不 grep handler 原始碼。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { seedUser, seedTrip, seedEntry, seedPoi, getDayId } from './helpers';
import { createEntry, createEntriesBatch } from '../../functions/api/_entryWrite';

let db: D1Database;
const owner = 'intake@test.com';
const tripId = 'trip-intake';
let dayId: number;
const audit = { tripId, changedBy: owner };

beforeAll(async () => {
  db = await createTestDb();
  await seedUser(db, owner);
  await seedTrip(db, { id: tripId, owner, days: 2 });
  dayId = await getDayId(db, tripId, 2);
});
afterAll(disposeMiniflare);

async function entryRow(id: number) {
  return db.prepare('SELECT * FROM trip_entries WHERE id = ?').bind(id).first<Record<string, unknown>>();
}
async function masterRow(entryId: number) {
  return db.prepare('SELECT * FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1').bind(entryId).first<Record<string, unknown>>();
}
async function dayOrder() {
  const r = await db.prepare('SELECT id, sort_order, start_time FROM trip_entries WHERE day_id = ? ORDER BY sort_order').bind(dayId).all<{ id: number; sort_order: number; start_time: string | null }>();
  return r.results;
}

describe('createEntry', () => {
  it('append：無 placement → 排在最後；正選含 note；version=1；audit 存在', async () => {
    const poiId = await seedPoi(db, { name: '正選 A', type: 'attraction' });
    const res = await createEntry(db, {
      dayId, poi: { id: poiId }, startTime: '10:00', endTime: '11:00', note: '收藏備註', source: 'fast-path', audit,
    });
    expect(res.poiId).toBe(poiId);
    expect(res.version).toBe(1);
    const e = await entryRow(res.entryId);
    expect(e!.entry_pois_version).toBe(1);
    expect(e!.source).toBe('fast-path');
    const m = await masterRow(res.entryId);
    expect(m!.poi_id).toBe(poiId);
    expect(m!.note).toBe('收藏備註');
    const a = await db.prepare("SELECT * FROM audit_log WHERE table_name = 'trip_entries' AND record_id = ? AND action = 'insert'").bind(res.entryId).first();
    expect(a).not.toBeNull();
  });

  it('insert-before 讓位：既有 entry sort_order 往後推；resort 依抵達時間正規化', async () => {
    // 現況：A(10:00). 插入 B(08:00) 到 A 前面（shift），再插 C(12:00) append。
    const poiB = await seedPoi(db, { name: '正選 B', type: 'restaurant' });
    const poiC = await seedPoi(db, { name: '正選 C', type: 'restaurant' });
    const before = await dayOrder();
    const aSort = before[0]!.sort_order;
    const b = await createEntry(db, { dayId, poi: { id: poiB }, startTime: '08:00', endTime: '09:00', placement: { sortOrder: aSort, shift: true }, audit });
    const c = await createEntry(db, { dayId, poi: { id: poiC }, startTime: '12:00', endTime: '13:00', audit });
    const order = await dayOrder();
    expect(order.map((r) => r.start_time)).toEqual(['08:00', '10:00', '12:00']);
    expect(order[0]!.id).toBe(b.entryId);
    expect(order[2]!.id).toBe(c.entryId);
    expect(order.map((r) => r.sort_order)).toEqual([0, 1, 2]);
  });

  it('append 但抵達時間更早 → resort 把它拉到正確時序位置（不是靠 placement）', async () => {
    const poiE = await seedPoi(db, { name: '正選 E', type: 'attraction' });
    const e = await createEntry(db, { dayId, poi: { id: poiE }, startTime: '07:00', endTime: '07:30', audit });
    const order = await dayOrder();
    expect(order[0]!.id).toBe(e.entryId);
    expect(order.map((r) => r.start_time)).toEqual(['07:00', '08:00', '10:00', '12:00']);
  });

  it('POI 走 find-or-create：keep 不改既有 master', async () => {
    const existing = await db.prepare("INSERT INTO pois (type, name, address) VALUES ('restaurant', 'Intake 食堂', '原地址') RETURNING id").first<{ id: number }>();
    const res = await createEntry(db, {
      dayId, poi: { data: { name: 'Intake 食堂', type: 'restaurant', address: '新地址' }, policy: 'keep' },
      startTime: null, endTime: null, audit,
    });
    expect(res.poiId).toBe(existing!.id);
    const p = await db.prepare('SELECT address FROM pois WHERE id = ?').bind(res.poiId).first<{ address: string }>();
    expect(p!.address).toBe('原地址');
  });

  it('entry_pois 寫入失敗 → 補償 DELETE entry，不留孤兒', async () => {
    const poiId = await seedPoi(db, { name: '正選 D', type: 'attraction' });
    const countBefore = (await db.prepare('SELECT COUNT(*) AS n FROM trip_entries WHERE day_id = ?').bind(dayId).first<{ n: number }>())!.n;
    // 用不存在的 poi id 觸發 FK 失敗（pois 外鍵）
    await expect(createEntry(db, { dayId, poi: { id: 999999 }, startTime: null, endTime: null, audit })).rejects.toThrow();
    const countAfter = (await db.prepare('SELECT COUNT(*) AS n FROM trip_entries WHERE day_id = ?').bind(dayId).first<{ n: number }>())!.n;
    expect(countAfter).toBe(countBefore);
    void poiId;
  });
});

describe('createEntriesBatch（複製 / clone / 匯入 / 整日重寫的批次入口）', () => {
  let batchDayId: number;
  beforeAll(async () => { batchDayId = await getDayId(db, tripId, 1); });

  it('一次多筆：正選 + 備選各自 note；同 entry 重複 POI 去重；無 POI 的 entry version=0；每筆 audit', async () => {
    const p1 = await seedPoi(db, { name: 'Batch 正選', type: 'attraction' });
    const p2 = await seedPoi(db, { name: 'Batch 備選', type: 'restaurant' });
    const ids = await createEntriesBatch(db, [
      { dayId: batchDayId, sortOrder: 0, startTime: '09:00', endTime: '10:00', source: 'imported',
        pois: [{ poiId: p1, note: '正選備註' }, { poiId: p2, note: '備選備註', reservation: '已訂位' }, { poiId: p1 }] },
      { dayId: batchDayId, sortOrder: 1, startTime: null, endTime: null, pois: [] },
    ], { audit: { tripId, changedBy: owner } });
    expect(ids).toHaveLength(2);
    const rows = await db.prepare('SELECT poi_id, sort_order, note, reservation FROM trip_entry_pois WHERE entry_id = ? ORDER BY sort_order').bind(ids[0]).all<{ poi_id: number; sort_order: number; note: string | null; reservation: string | null }>();
    expect(rows.results).toEqual([
      { poi_id: p1, sort_order: 1, note: '正選備註', reservation: null },
      { poi_id: p2, sort_order: 2, note: '備選備註', reservation: '已訂位' },
    ]);
    const v = await db.prepare('SELECT id, entry_pois_version, source FROM trip_entries WHERE id IN (?, ?) ORDER BY sort_order').bind(ids[0], ids[1]).all<{ id: number; entry_pois_version: number; source: string }>();
    expect(v.results.map((r) => r.entry_pois_version)).toEqual([1, 0]);
    expect(v.results[0]!.source).toBe('imported');
    const audits = await db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE table_name = 'trip_entries' AND action = 'insert' AND record_id IN (?, ?)").bind(ids[0], ids[1]).first<{ n: number }>();
    expect(audits!.n).toBe(2);
  });

  it('entry_pois 階段失敗 → 已建的 entries 全數補償刪除', async () => {
    const before = (await db.prepare('SELECT COUNT(*) AS n FROM trip_entries WHERE day_id = ?').bind(batchDayId).first<{ n: number }>())!.n;
    await expect(createEntriesBatch(db, [
      { dayId: batchDayId, sortOrder: 5, startTime: null, endTime: null, pois: [{ poiId: 999999 }] },
    ], {})).rejects.toThrow();
    const after = (await db.prepare('SELECT COUNT(*) AS n FROM trip_entries WHERE day_id = ?').bind(batchDayId).first<{ n: number }>())!.n;
    expect(after).toBe(before);
  });
});

describe('createEntriesBatch 批次大小', () => {
  it('60 筆（超過 50 chunk）全部建立、順序與 sort_order 一致；onEntryId 帶 row', async () => {
    const dayId = await getDayId(db, tripId, 1);
    const poiId = await seedPoi(db, { name: 'Chunk POI', type: 'attraction' });
    const specs = Array.from({ length: 60 }, (_, i) => ({ dayId, sortOrder: 100 + i, startTime: null, endTime: null, pois: [{ poiId, note: `n${i}` }] }));
    const rows: number[] = [];
    const ids = await createEntriesBatch(db, specs, { onEntryId: (_id, idx, row) => { rows[idx] = row.sort_order as number; } });
    expect(ids).toHaveLength(60);
    expect(rows).toEqual(specs.map((s) => s.sortOrder));
    const n = await db.prepare('SELECT COUNT(*) AS n FROM trip_entry_pois WHERE entry_id IN (SELECT id FROM trip_entries WHERE day_id = ? AND sort_order >= 100)').bind(dayId).first<{ n: number }>();
    expect(n!.n).toBe(60);
  });
  it('atomicWith：前置 DELETE 與 entries INSERT 同一批 —— 失敗時舊 entries 仍在（不會砍完才建一半）', async () => {
    const dayId = await getDayId(db, tripId, 1);
    const before = (await db.prepare('SELECT COUNT(*) AS n FROM trip_entries WHERE day_id = ?').bind(dayId).first<{ n: number }>())!.n;
    expect(before).toBeGreaterThan(0);
    // 55 筆合法 + 第 56 筆 day_id 指向不存在的 day（FK 失敗）。舊碼分 50 一 chunk：第一 chunk
    //（DELETE + 49 筆）已 commit、第二 chunk 才炸 → 舊 entries 消失；現在整批一次送 → 全部 rollback。
    const specs = [
      ...Array.from({ length: 55 }, (_, i) => ({ dayId, sortOrder: 500 + i, startTime: null, endTime: null, pois: [] })),
      { dayId: 999999, sortOrder: 0, startTime: null, endTime: null, pois: [] },
    ];
    await expect(createEntriesBatch(db, specs, {
      atomicWith: [db.prepare('DELETE FROM trip_entries WHERE day_id = ?').bind(dayId)],
    })).rejects.toThrow();
    const after = (await db.prepare('SELECT COUNT(*) AS n FROM trip_entries WHERE day_id = ?').bind(dayId).first<{ n: number }>())!.n;
    expect(after).toBe(before);
  });
});
