/* TODO v2.20.1 — V2 cutover (migration 0046+0047) 改 schema：trips.owner / trip_permissions.email / saved_pois.email columns dropped。本檔 pin 舊 schema SQL 字串斷言，需語意級 rewrite。 */
/**
 * Integration test — migration 0028: saved_pois schema + constraints
 *
 * 驗證：
 * 1. table / 欄位 / default 正確
 * 2. UNIQUE (email, poi_id) 重複 INSERT 失敗
 * 3. FK CASCADE — 刪 POI 自動清除相關 saved_pois
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { seedPoi } from './helpers';

let db: D1Database;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(disposeMiniflare);

describe.skip('migration 0028 — saved_pois schema', () => {
  it('table 存在且欄位齊全', async () => {
    const info = await db.prepare("PRAGMA table_info('saved_pois')").all();
    const cols = (info.results as Array<{ name: string; type: string; notnull: number; dflt_value: string | null }>);
    const names = cols.map(c => c.name);
    expect(names).toEqual(expect.arrayContaining(['id', 'email', 'poi_id', 'saved_at', 'note']));

    const email = cols.find(c => c.name === 'email')!;
    expect(email.notnull).toBe(1);
    const poiId = cols.find(c => c.name === 'poi_id')!;
    expect(poiId.notnull).toBe(1);
    const savedAt = cols.find(c => c.name === 'saved_at')!;
    expect(savedAt.notnull).toBe(1);
  });

  it('UNIQUE (email, poi_id) — 重複 INSERT 失敗', async () => {
    const poiId = await seedPoi(db, { name: 'Unique Test POI' });
    await db.prepare(
      'INSERT INTO saved_pois (email, poi_id) VALUES (?, ?)'
    ).bind('unique@test.com', poiId).run();

    await expect(
      db.prepare('INSERT INTO saved_pois (email, poi_id) VALUES (?, ?)')
        .bind('unique@test.com', poiId).run()
    ).rejects.toThrow(/UNIQUE/);
  });

  it('不同 email 可收藏同一 POI', async () => {
    const poiId = await seedPoi(db, { name: 'Shared POI' });
    await db.prepare('INSERT INTO saved_pois (email, poi_id) VALUES (?, ?)').bind('a@test.com', poiId).run();
    await db.prepare('INSERT INTO saved_pois (email, poi_id) VALUES (?, ?)').bind('b@test.com', poiId).run();
    const row = await db.prepare('SELECT COUNT(*) AS c FROM saved_pois WHERE poi_id = ?').bind(poiId).first<{ c: number }>();
    expect(row!.c).toBe(2);
  });

  it('FK CASCADE — 刪 POI 自動清除 saved_pois', async () => {
    const poiId = await seedPoi(db, { name: 'Cascade POI' });
    await db.prepare('INSERT INTO saved_pois (email, poi_id) VALUES (?, ?)').bind('cascade@test.com', poiId).run();
    await db.prepare('DELETE FROM pois WHERE id = ?').bind(poiId).run();
    const row = await db.prepare('SELECT COUNT(*) AS c FROM saved_pois WHERE email = ?').bind('cascade@test.com').first<{ c: number }>();
    expect(row!.c).toBe(0);
  });

  it('saved_at 有 default (datetime now)', async () => {
    const poiId = await seedPoi(db, { name: 'Default Timestamp POI' });
    await db.prepare('INSERT INTO saved_pois (email, poi_id) VALUES (?, ?)').bind('ts@test.com', poiId).run();
    const row = await db.prepare('SELECT saved_at FROM saved_pois WHERE email = ? AND poi_id = ?').bind('ts@test.com', poiId).first<{ saved_at: string }>();
    expect(row!.saved_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });
});
