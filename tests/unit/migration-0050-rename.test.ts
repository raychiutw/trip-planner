// @vitest-environment node
/**
 * Migration 0050 schema verify — poi_favorites table 結構正確
 *
 * 對映 OpenSpec change poi-favorites-rename / specs/poi-favorites/spec.md
 * Requirement: POI 收藏池 D1 schema
 *
 * 用 node env（不是預設 jsdom）— Miniflare ProxyStubHandler 不支援 jsdom。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from '../api/setup';

describe('migration 0050 — poi_favorites schema', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(disposeMiniflare);

  it('poi_favorites table 含 5 columns', async () => {
    const { results } = await db.prepare("PRAGMA table_info('poi_favorites')").all();
    const columns = results.map((r) => (r as { name: string }).name).sort();
    expect(columns).toEqual(['favorited_at', 'id', 'note', 'poi_id', 'user_id']);
  });

  it('id 為 INTEGER PRIMARY KEY AUTOINCREMENT', async () => {
    const { results } = await db.prepare("PRAGMA table_info('poi_favorites')").all();
    const idCol = results.find((r) => (r as { name: string }).name === 'id') as
      | { type: string; pk: number; notnull: number }
      | undefined;
    expect(idCol).toBeDefined();
    expect(idCol!.type).toBe('INTEGER');
    expect(idCol!.pk).toBe(1);
  });

  it('user_id NOT NULL + FK users(id) ON DELETE CASCADE', async () => {
    const { results: cols } = await db.prepare("PRAGMA table_info('poi_favorites')").all();
    const userIdCol = cols.find((r) => (r as { name: string }).name === 'user_id') as
      | { type: string; notnull: number }
      | undefined;
    expect(userIdCol!.type).toBe('TEXT');
    expect(userIdCol!.notnull).toBe(1);

    const { results: fks } = await db.prepare("PRAGMA foreign_key_list('poi_favorites')").all();
    const userFk = fks.find((r) => (r as { from: string }).from === 'user_id') as
      | { table: string; on_delete: string }
      | undefined;
    expect(userFk).toBeDefined();
    expect(userFk!.table).toBe('users');
    expect(userFk!.on_delete).toBe('CASCADE');
  });

  it('poi_id NOT NULL + FK pois(id) ON DELETE CASCADE', async () => {
    const { results: cols } = await db.prepare("PRAGMA table_info('poi_favorites')").all();
    const poiIdCol = cols.find((r) => (r as { name: string }).name === 'poi_id') as
      | { type: string; notnull: number }
      | undefined;
    expect(poiIdCol!.type).toBe('INTEGER');
    expect(poiIdCol!.notnull).toBe(1);

    const { results: fks } = await db.prepare("PRAGMA foreign_key_list('poi_favorites')").all();
    const poiFk = fks.find((r) => (r as { from: string }).from === 'poi_id') as
      | { table: string; on_delete: string }
      | undefined;
    expect(poiFk!.table).toBe('pois');
    expect(poiFk!.on_delete).toBe('CASCADE');
  });

  it('favorited_at NOT NULL DEFAULT datetime(now)', async () => {
    const { results: cols } = await db.prepare("PRAGMA table_info('poi_favorites')").all();
    const col = cols.find((r) => (r as { name: string }).name === 'favorited_at') as
      | { type: string; notnull: number; dflt_value: string }
      | undefined;
    expect(col!.type).toBe('TEXT');
    expect(col!.notnull).toBe(1);
    expect(col!.dflt_value).toContain("datetime('now')");
  });

  it('UNIQUE (user_id, poi_id) constraint 存在', async () => {
    const { results: indexes } = await db.prepare("PRAGMA index_list('poi_favorites')").all();
    const uniqueIdx = indexes.find((r) => (r as { unique: number }).unique === 1);
    expect(uniqueIdx).toBeDefined();

    const idxName = (uniqueIdx as { name: string }).name;
    const { results: idxCols } = await db.prepare(`PRAGMA index_info('${idxName}')`).all();
    const colNames = idxCols.map((r) => (r as { name: string }).name).sort();
    expect(colNames).toEqual(['poi_id', 'user_id']);
  });

  it('idx_poi_favorites_poi index 存在於 poi_id', async () => {
    const { results } = await db.prepare("PRAGMA index_list('poi_favorites')").all();
    const named = results.find((r) => (r as { name: string }).name === 'idx_poi_favorites_poi');
    expect(named).toBeDefined();

    const { results: idxCols } = await db.prepare(
      "PRAGMA index_info('idx_poi_favorites_poi')",
    ).all();
    expect(idxCols).toHaveLength(1);
    expect((idxCols[0] as { name: string }).name).toBe('poi_id');
  });
});
