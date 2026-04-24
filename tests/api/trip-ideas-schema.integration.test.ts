/**
 * Integration test — migration 0029: trip_ideas schema + FK behavior
 *
 * 驗證：
 * 1. table / 欄位 / default 正確
 * 2. FK trip_id ON DELETE CASCADE — trip 刪除時 ideas 自動清
 * 3. FK poi_id ON DELETE SET NULL — POI 刪除時 idea 保留但 poi_id 設 NULL
 * 4. FK promoted_to_entry_id ON DELETE SET NULL — entry 刪除時標記設 NULL
 * 5. 支援 poi_id = NULL（自由文字 idea）
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { seedTrip, seedPoi, seedEntry, getDayId } from './helpers';

let db: D1Database;

beforeAll(async () => {
  db = await createTestDb();
  await seedTrip(db, { id: 'idea-trip' });
});

afterAll(disposeMiniflare);

describe('migration 0029 — trip_ideas schema', () => {
  it('table 存在且欄位齊全', async () => {
    const info = await db.prepare("PRAGMA table_info('trip_ideas')").all();
    const cols = (info.results as Array<{ name: string; notnull: number }>);
    const names = cols.map(c => c.name);
    expect(names).toEqual(expect.arrayContaining([
      'id', 'trip_id', 'poi_id', 'title', 'note',
      'added_at', 'added_by', 'promoted_to_entry_id', 'archived_at',
    ]));

    expect(cols.find(c => c.name === 'trip_id')!.notnull).toBe(1);
    expect(cols.find(c => c.name === 'title')!.notnull).toBe(1);
    expect(cols.find(c => c.name === 'added_at')!.notnull).toBe(1);
    // poi_id nullable（自由文字 idea）
    expect(cols.find(c => c.name === 'poi_id')!.notnull).toBe(0);
  });

  it('支援 poi_id = NULL（自由文字 idea）', async () => {
    await db.prepare(
      'INSERT INTO trip_ideas (trip_id, title) VALUES (?, ?)'
    ).bind('idea-trip', '去超市買零食').run();
    const row = await db.prepare(
      "SELECT title, poi_id FROM trip_ideas WHERE title = ?"
    ).bind('去超市買零食').first<{ title: string; poi_id: number | null }>();
    expect(row!.title).toBe('去超市買零食');
    expect(row!.poi_id).toBeNull();
  });

  it('FK poi_id ON DELETE SET NULL — 刪 POI 保留 idea 清 poi_id', async () => {
    const poiId = await seedPoi(db, { name: 'Idea Source POI' });
    await db.prepare(
      'INSERT INTO trip_ideas (trip_id, poi_id, title) VALUES (?, ?, ?)'
    ).bind('idea-trip', poiId, 'POI-based Idea').run();

    await db.prepare('DELETE FROM pois WHERE id = ?').bind(poiId).run();

    const row = await db.prepare(
      'SELECT title, poi_id FROM trip_ideas WHERE title = ?'
    ).bind('POI-based Idea').first<{ title: string; poi_id: number | null }>();
    expect(row).not.toBeNull();
    expect(row!.title).toBe('POI-based Idea');
    expect(row!.poi_id).toBeNull();
  });

  it('FK trip_id ON DELETE CASCADE — 刪 trip ideas 自動清', async () => {
    await seedTrip(db, { id: 'cascade-trip' });
    await db.prepare(
      'INSERT INTO trip_ideas (trip_id, title) VALUES (?, ?)'
    ).bind('cascade-trip', 'Will Be Cascaded').run();

    await db.prepare('DELETE FROM trips WHERE id = ?').bind('cascade-trip').run();

    const row = await db.prepare(
      'SELECT COUNT(*) AS c FROM trip_ideas WHERE trip_id = ?'
    ).bind('cascade-trip').first<{ c: number }>();
    expect(row!.c).toBe(0);
  });

  it('FK promoted_to_entry_id ON DELETE SET NULL — 刪 entry idea 保留', async () => {
    const dayId = await getDayId(db, 'idea-trip', 1);
    const entryId = await seedEntry(db, dayId, { title: 'Promoted Entry' });
    await db.prepare(
      'INSERT INTO trip_ideas (trip_id, title, promoted_to_entry_id) VALUES (?, ?, ?)'
    ).bind('idea-trip', 'Promoted Idea', entryId).run();

    await db.prepare('DELETE FROM trip_entries WHERE id = ?').bind(entryId).run();

    const row = await db.prepare(
      'SELECT title, promoted_to_entry_id FROM trip_ideas WHERE title = ?'
    ).bind('Promoted Idea').first<{ title: string; promoted_to_entry_id: number | null }>();
    expect(row).not.toBeNull();
    expect(row!.promoted_to_entry_id).toBeNull();
  });
});
