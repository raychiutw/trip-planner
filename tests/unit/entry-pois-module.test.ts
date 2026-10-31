/**
 * _entry_pois 的 module 測試：syncEntryMaster（直接呼叫內部函式）與 entry 刪除的 FK cascade（直接對 D1 驗證）。
 * 從 tests/api/entry-pois.integration.test.ts 拆出：這些不經 handler，不屬於 HTTP 邊界套件。
 * 共用 D1：行程 id 以 's17b-ep' 開頭，afterAll 依此樣式清掉。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from '../api/setup';
import { seedTrip, seedEntry, seedPoi, getDayId } from '../api/helpers';
import { cleanupTrips } from '../api/cleanup-trips';
import { syncEntryMaster } from '../../functions/api/_entry_pois';

let db: D1Database;
const TRIP_ID = 's17b-ep';
const OWNER = 's17b-ep-owner@test.com';
const poiIds: number[] = [];
const track = <T extends { id: number } | null>(row: T): NonNullable<T> => {
  poiIds.push(row!.id);
  return row as NonNullable<T>;
};
const newPoi = async (name: string, type = 'attraction'): Promise<number> => {
  const id = await seedPoi(db, { name, type });
  poiIds.push(id);
  return id;
};
const readVersion = async (entryId: number): Promise<number> => {
  const row = await db
    .prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?')
    .bind(entryId)
    .first<{ v: number }>();
  return row!.v;
};

beforeAll(async () => {
  db = await createTestDb();
  await seedTrip(db, { id: TRIP_ID, owner: OWNER });
}, 30000);

afterAll(async () => {
  await cleanupTrips(db, ['s17b-ep%']);
  await db.prepare("DELETE FROM audit_log WHERE trip_id LIKE 's17b-ep%'").run();
  for (const id of new Set(poiIds)) await db.prepare('DELETE FROM pois WHERE id = ?').bind(id).run();
  await disposeMiniflare();
});

async function seedEntryWithMaster(opts: {
  poiName: string;
  altPoiNames?: string[];
}): Promise<{ entryId: number; masterPoiId: number; altPoiIds: number[] }> {
  const dayId = await getDayId(db, TRIP_ID, 1);
  const masterPoiId = await newPoi(opts.poiName);
  const entryId = await seedEntry(db, dayId, { poiId: masterPoiId });
  const altPoiIds: number[] = [];
  if (opts.altPoiNames) {
    for (let i = 0; i < opts.altPoiNames.length; i++) {
      const altId = await newPoi(opts.altPoiNames[i]!);
      altPoiIds.push(altId);
      await db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, ?)').bind(entryId, altId, i + 2).run();
    }
  }
  return { entryId, masterPoiId, altPoiIds };
}

describe('Cascade behavior', () => {
  it('DELETE entry → ON DELETE CASCADE 清掉所有 trip_entry_pois', async () => {
    const { entryId } = await seedEntryWithMaster({
      poiName: 'Cascade-Master',
      altPoiNames: ['Cascade-A', 'Cascade-B'],
    });
    const before = await db
      .prepare('SELECT COUNT(*) AS c FROM trip_entry_pois WHERE entry_id = ?')
      .bind(entryId)
      .first<{ c: number }>();
    expect(before!.c).toBe(3);

    await db.prepare('DELETE FROM trip_entries WHERE id = ?').bind(entryId).run();

    const after = await db
      .prepare('SELECT COUNT(*) AS c FROM trip_entry_pois WHERE entry_id = ?')
      .bind(entryId)
      .first<{ c: number }>();
    expect(after!.c).toBe(0);
  });
});


// migration 0078 — syncEntryMaster 可選 note 參數（給 entry-create 路徑把 entry-level note
// 寫進新 master 的 per-POI note）。只作用於 INSERT(new master) 分支；既有呼叫端不傳 → 維持現狀。
describe('migration 0078 — syncEntryMaster optional note 參數', () => {
  it('INSERT 新 master 時帶 note → 寫進 trip_entry_pois.note', async () => {
    const trip = await seedTrip(db, { id: 's17b-ep-m78-sync-note-insert', owner: OWNER });
    const dayId = await getDayId(db, trip.id, 1);
    const poi = track(await db.prepare("INSERT INTO pois (name, type) VALUES ('M78-INS', 'attraction') RETURNING id").first<{ id: number }>());
    const entry = await db.prepare("INSERT INTO trip_entries (day_id, sort_order, start_time) VALUES (?, 1, '10:00') RETURNING id").bind(dayId).first<{ id: number }>();

    await syncEntryMaster(db, entry!.id, poi.id, '整體備註注入 master');

    const row = await db.prepare('SELECT note, sort_order FROM trip_entry_pois WHERE entry_id = ?').bind(entry!.id).first<{ note: string | null; sort_order: number }>();
    expect(row!.sort_order).toBe(1);
    expect(row!.note).toBe('整體備註注入 master');
  });

  it('不傳 note（既有呼叫端）→ master.note 維持 NULL（向後相容）', async () => {
    const trip = await seedTrip(db, { id: 's17b-ep-m78-sync-note-omit', owner: OWNER });
    const dayId = await getDayId(db, trip.id, 1);
    const poi = track(await db.prepare("INSERT INTO pois (name, type) VALUES ('M78-OMIT', 'attraction') RETURNING id").first<{ id: number }>());
    const entry = await db.prepare("INSERT INTO trip_entries (day_id, sort_order, start_time) VALUES (?, 1, '10:00') RETURNING id").bind(dayId).first<{ id: number }>();

    await syncEntryMaster(db, entry!.id, poi.id);

    const row = await db.prepare('SELECT note FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1').bind(entry!.id).first<{ note: string | null }>();
    expect(row!.note).toBeNull();
  });

  it('note 為 null 顯式傳入 → master.note NULL（不炸）', async () => {
    const trip = await seedTrip(db, { id: 's17b-ep-m78-sync-note-null', owner: OWNER });
    const dayId = await getDayId(db, trip.id, 1);
    const poi = track(await db.prepare("INSERT INTO pois (name, type) VALUES ('M78-NULL', 'attraction') RETURNING id").first<{ id: number }>());
    const entry = await db.prepare("INSERT INTO trip_entries (day_id, sort_order, start_time) VALUES (?, 1, '10:00') RETURNING id").bind(dayId).first<{ id: number }>();

    await syncEntryMaster(db, entry!.id, poi.id, null);

    const row = await db.prepare('SELECT note FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1').bind(entry!.id).first<{ note: string | null }>();
    expect(row!.note).toBeNull();
  });
});

// Round 9 — syncEntryMaster INSERT + naked UPDATE 各自 bump entry_pois_version 的 regression。
// Round 7 修了這兩條 path 加 bump，但既有 syncEntryMaster test 只走 setMaster collision route。
describe('Round 9 — syncEntryMaster INSERT/naked UPDATE bump entry_pois_version', () => {
  it('INSERT path (entry 沒 trip_entry_pois row) → bump version', async () => {
    const trip = await seedTrip(db, { id: 's17b-ep-r9-sync-insert', owner: OWNER });
    const dayId = await getDayId(db, trip.id, 1);
    const poi = track(await db.prepare("INSERT INTO pois (name, type) VALUES ('R9-INS-POI', 'attraction') RETURNING id").first<{ id: number }>());
    // 故意建 entry 後不 INSERT trip_entry_pois，模擬 entry-create 中間狀態
    // v2.29.0: trip_entries.{time, poi_id} DROPPED. 用 start_time 寫 schedule。
    const entry = await db.prepare("INSERT INTO trip_entries (day_id, sort_order, start_time) VALUES (?, 1, '10:00') RETURNING id").bind(dayId).first<{ id: number }>();
    const v0 = await readVersion(entry!.id);

    await syncEntryMaster(db, entry!.id, poi.id);

    expect(await readVersion(entry!.id)).toBe(v0 + 1);
    const row = await db.prepare('SELECT poi_id, sort_order FROM trip_entry_pois WHERE entry_id = ?').bind(entry!.id).first<{ poi_id: number; sort_order: number }>();
    expect(row!.sort_order).toBe(1);
    expect(row!.poi_id).toBe(poi.id);
  });

  it('naked UPDATE path (master 已存在 + new poiId 不是 alternate) → bump version', async () => {
    const trip = await seedTrip(db, { id: 's17b-ep-r9-sync-update', owner: OWNER });
    const dayId = await getDayId(db, trip.id, 1);
    const poiOld = track(await db.prepare("INSERT INTO pois (name, type) VALUES ('R9-OldMaster', 'attraction') RETURNING id").first<{ id: number }>());
    const poiNew = track(await db.prepare("INSERT INTO pois (name, type) VALUES ('R9-NewMaster', 'attraction') RETURNING id").first<{ id: number }>());
    // v2.29.0: trip_entries.{time, poi_id} DROPPED. 用 start_time + trip_entry_pois 寫 master。
    const entry = await db.prepare("INSERT INTO trip_entries (day_id, sort_order, start_time) VALUES (?, 1, '11:00') RETURNING id").bind(dayId).first<{ id: number }>();
    await db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)').bind(entry!.id, poiOld.id).run();
    const v0 = await readVersion(entry!.id);

    await syncEntryMaster(db, entry!.id, poiNew.id);

    expect(await readVersion(entry!.id)).toBe(v0 + 1);
    const row = await db.prepare('SELECT poi_id FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1').bind(entry!.id).first<{ poi_id: number }>();
    expect(row!.poi_id).toBe(poiNew.id);
  });

  it('no-op path (poiId 跟既有 master 相同) → 不 bump version', async () => {
    const trip = await seedTrip(db, { id: 's17b-ep-r9-sync-noop', owner: OWNER });
    const dayId = await getDayId(db, trip.id, 1);
    const poi = track(await db.prepare("INSERT INTO pois (name, type) VALUES ('R9-NoOp', 'attraction') RETURNING id").first<{ id: number }>());
    // v2.29.0: trip_entries.{time, poi_id} DROPPED. 用 start_time + trip_entry_pois 寫 master。
    const entry = await db.prepare("INSERT INTO trip_entries (day_id, sort_order, start_time) VALUES (?, 1, '12:00') RETURNING id").bind(dayId).first<{ id: number }>();
    await db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)').bind(entry!.id, poi.id).run();
    const v0 = await readVersion(entry!.id);

    await syncEntryMaster(db, entry!.id, poi.id);

    expect(await readVersion(entry!.id)).toBe(v0); // unchanged
  });
});

describe('Round 4 — syncEntryMaster routes UNIQUE collision to setMaster (adv-C4 fix)', () => {
  it('syncEntryMaster when poiId is already alternate → master↔alt swap (not UNIQUE 500)', async () => {
    const { entryId, masterPoiId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'C4-Master',
      altPoiNames: ['C4-Alt'],
    });
    // Simulate a PUT /days/:num flow: caller wants to make C4-Alt the master for this entry
    // (previously this would crash with UNIQUE(entry_id, poi_id) because C4-Alt was already an alternate).
    await syncEntryMaster(db, entryId, altPoiIds[0]!);

    // Verify the swap happened: C4-Alt is now master (sort_order=1), C4-Master is alternate
    const rows = await db
      .prepare('SELECT poi_id, sort_order FROM trip_entry_pois WHERE entry_id = ? ORDER BY sort_order')
      .bind(entryId)
      .all<{ poi_id: number; sort_order: number }>();
    expect(rows.results.length).toBe(2);
    expect(rows.results[0]).toMatchObject({ poi_id: altPoiIds[0], sort_order: 1 });
    expect(rows.results[1]!.poi_id).toBe(masterPoiId);
  });
});

