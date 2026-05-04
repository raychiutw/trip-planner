// @vitest-environment node
/**
 * Migration 0050 — saved_pois → poi_favorites data copy verify
 *
 * 對映 specs/poi-favorites/spec.md Requirement: POI 收藏池 D1 schema
 * + design.md D1 expand-contract pattern phase 1
 *
 * 本 test 預埋 saved_pois rows 後直接 verify poi_favorites 已含對應 row
 * (createTestDb 已 apply 0050 migration，INSERT SELECT 應已執行過 — 但本機
 *  vitest fixture 是空表，需手動 seed + re-run INSERT 模擬 prod cutover 行為)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from '../api/setup';
import { seedUser, seedPoi } from '../api/helpers';

describe('migration 0050 — data copy from saved_pois', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30000);

  afterAll(disposeMiniflare);

  it('預埋 saved_pois → 跑 INSERT SELECT → poi_favorites 含對應 rows', async () => {
    // 清空 (createTestDb 是 shared fixture，避免污染)
    await db.prepare('DELETE FROM poi_favorites').run();
    await db.prepare('DELETE FROM saved_pois').run();

    const u1 = await seedUser(db, 'data-copy-1@test.com');
    const u2 = await seedUser(db, 'data-copy-2@test.com');
    const p1 = await seedPoi(db, { name: 'POI-1' });
    const p2 = await seedPoi(db, { name: 'POI-2' });

    await db.prepare(
      'INSERT INTO saved_pois (id, user_id, poi_id, saved_at, note) VALUES (?, ?, ?, ?, ?)',
    ).bind(101, u1, p1, '2026-04-01 12:00:00', 'note-A').run();
    await db.prepare(
      'INSERT INTO saved_pois (id, user_id, poi_id, saved_at, note) VALUES (?, ?, ?, ?, ?)',
    ).bind(102, u2, p2, '2026-04-15 18:30:00', null).run();

    // 模擬 migration 0050 step 4 INSERT SELECT
    await db.prepare(
      `INSERT INTO poi_favorites (id, user_id, poi_id, favorited_at, note)
       SELECT id, user_id, poi_id, saved_at, note FROM saved_pois`,
    ).run();

    const { results } = await db.prepare(
      'SELECT id, user_id, poi_id, favorited_at, note FROM poi_favorites ORDER BY id',
    ).all();
    expect(results).toHaveLength(2);

    const r1 = results[0] as { id: number; user_id: string; poi_id: number; favorited_at: string; note: string | null };
    expect(r1.id).toBe(101);
    expect(r1.user_id).toBe(u1);
    expect(r1.poi_id).toBe(p1);
    expect(r1.favorited_at).toBe('2026-04-01 12:00:00');
    expect(r1.note).toBe('note-A');

    const r2 = results[1] as { id: number; favorited_at: string; note: string | null };
    expect(r2.id).toBe(102);
    expect(r2.favorited_at).toBe('2026-04-15 18:30:00');
    expect(r2.note).toBeNull();
  });

  it('saved_pois 仍存在 (dual-table phase)', async () => {
    const { results } = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='saved_pois'",
    ).all();
    expect(results).toHaveLength(1);
  });

  it('column rename: saved_pois.saved_at → poi_favorites.favorited_at', async () => {
    const { results: savedCols } = await db.prepare(
      "PRAGMA table_info('saved_pois')",
    ).all();
    const savedColNames = savedCols.map((r) => (r as { name: string }).name);
    expect(savedColNames).toContain('saved_at');
    expect(savedColNames).not.toContain('favorited_at');

    const { results: favCols } = await db.prepare(
      "PRAGMA table_info('poi_favorites')",
    ).all();
    const favColNames = favCols.map((r) => (r as { name: string }).name);
    expect(favColNames).toContain('favorited_at');
    expect(favColNames).not.toContain('saved_at');
  });
});
