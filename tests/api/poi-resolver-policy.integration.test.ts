/**
 * #1256 — 單一 POI resolver，policy 為明確參數。
 *   keep      ：找到既有 row 絕不改（舊 resolvePoi 語意）
 *   fill-null ：只補 NULL 欄，不覆蓋非 NULL 值（舊 findOrCreatePoi 語意）
 * 走 interface 驗行為，取代 trip-import-wiring 內對 resolvePoi 的 source-grep。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { findOrCreatePoi, batchFindOrCreatePois, normalizeFindOrCreatePoiPayload } from '../../functions/api/_poi';

let db: D1Database;
beforeAll(async () => { db = await createTestDb(); });
afterAll(disposeMiniflare);

async function poiRow(id: number) {
  return db.prepare('SELECT * FROM pois WHERE id = ?').bind(id).first<Record<string, unknown>>();
}

describe('findOrCreatePoi policy', () => {
  it('keep：找到既有 row 任何欄位不變', async () => {
    const existing = await db.prepare(
      "INSERT INTO pois (type, name, address, rating, country) VALUES ('restaurant', 'Keep 食堂', NULL, 4.5, NULL) RETURNING id",
    ).first<{ id: number }>();
    const created: number[] = [];
    const id = await findOrCreatePoi(db, {
      name: 'Keep 食堂', type: 'restaurant', address: '新地址', rating: 1, source: 'imported',
    }, { policy: 'keep', createdPoiIds: created });
    expect(id).toBe(existing!.id);
    expect(created).toEqual([]);
    const row = await poiRow(id);
    expect(row!.address).toBeNull();
    expect(row!.rating).toBe(4.5);
  });

  it('fill-null：只補 NULL 欄，非 NULL 值不覆蓋', async () => {
    const existing = await db.prepare(
      "INSERT INTO pois (type, name, address, rating) VALUES ('restaurant', 'Fill 食堂', NULL, 4.5) RETURNING id",
    ).first<{ id: number }>();
    const id = await findOrCreatePoi(db, {
      name: 'Fill 食堂', type: 'restaurant', address: '補上的地址', rating: 1,
    }, { policy: 'fill-null' });
    expect(id).toBe(existing!.id);
    const row = await poiRow(id);
    expect(row!.address).toBe('補上的地址');
    expect(row!.rating).toBe(4.5);
  });

  it('不存在 → 新建，source 由 caller 決定，並記進 createdPoiIds', async () => {
    const created: number[] = [];
    const id = await findOrCreatePoi(db, {
      name: 'New 食堂', type: 'restaurant', source: 'imported',
    }, { policy: 'keep', createdPoiIds: created, defaultCountry: null });
    expect(created).toEqual([id]);
    const row = await poiRow(id);
    expect(row!.source).toBe('imported');
    expect(row!.country).toBeNull();
  });

  it('name+type 競態：第二次 INSERT OR IGNORE 落空後重取同一 id', async () => {
    const a = await findOrCreatePoi(db, { name: 'Race 食堂', type: 'restaurant' }, { policy: 'keep' });
    const b = await findOrCreatePoi(db, { name: 'Race 食堂', type: 'restaurant' }, { policy: 'keep' });
    expect(b).toBe(a);
  });
});

describe('batchFindOrCreatePois policy', () => {
  it('keep：既有 row 不改；fill-null：補 NULL 欄', async () => {
    const existing = await db.prepare(
      "INSERT INTO pois (type, name, address) VALUES ('attraction', 'Batch 景點', NULL) RETURNING id",
    ).first<{ id: number }>();
    const [k] = await batchFindOrCreatePois(db, [{ name: 'Batch 景點', type: 'attraction', address: 'K' }], { policy: 'keep' });
    expect(k).toBe(existing!.id);
    expect((await poiRow(k!))!.address).toBeNull();
    const [f] = await batchFindOrCreatePois(db, [{ name: 'Batch 景點', type: 'attraction', address: 'F' }], { policy: 'fill-null' });
    expect(f).toBe(existing!.id);
    expect((await poiRow(f!))!.address).toBe('F');
  });
});

describe('country 預設（行為不變）', () => {
  it('未給 country → 新建 JP；normalize 不給預設（null）；fill-null 撞既有 NULL country 不補成 JP', async () => {
    const a = await findOrCreatePoi(db, { name: 'Country 未給', type: 'attraction' }, { policy: 'fill-null' });
    expect((await poiRow(a))!.country).toBe('JP');
    const norm = normalizeFindOrCreatePoiPayload({ name: 'Country normalize', type: 'attraction', lat: 1, lng: 2 });
    expect(norm.country).toBeNull();
    // 既有 row country NULL，fill-null 撞到 → 維持 NULL（COALESCE 跳過 null，不會被 INSERT 預設值污染）
    const existing = await db.prepare("INSERT INTO pois (type, name, country) VALUES ('attraction', 'Country 既有 NULL', NULL) RETURNING id").first<{ id: number }>();
    const hit = await findOrCreatePoi(db, normalizeFindOrCreatePoiPayload({ name: 'Country 既有 NULL', type: 'attraction', lat: 1, lng: 2 }), { policy: 'fill-null' });
    expect(hit).toBe(existing!.id);
    expect((await poiRow(hit))!.country).toBeNull();
  });
  it('defaultCountry: null（匯入／clone）→ 新建存 NULL', async () => {
    const b = await findOrCreatePoi(db, { name: 'Country 匯入', type: 'attraction' }, { policy: 'fill-null', defaultCountry: null });
    expect((await poiRow(b))!.country).toBeNull();
  });
});
