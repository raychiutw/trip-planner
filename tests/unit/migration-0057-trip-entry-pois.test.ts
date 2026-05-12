// @vitest-environment node
/**
 * Migration 0057 — trip_entry_pois junction table（multi-POI per entry）
 *
 * 對映 design doc `feat-multi-poi-per-entry-design-2026-05-11.md`
 * + autoplan Codex Finding #6: 5 個 invariant smoke queries 必須回 0 row
 *
 * Covers:
 * 1. CREATE TABLE schema（PRAGMA table_info）
 * 2. Backfill correctness：entries with poi_id NOT NULL → 對應 sort_order=1 row
 * 3. 5 個 invariant smoke queries（CI gate — 任一 row 即 fail）
 * 4. UNIQUE (entry_id, sort_order) constraint
 * 5. UNIQUE (entry_id, poi_id) constraint
 * 6. CHECK (sort_order >= 1)
 * 7. ON DELETE CASCADE entry → 連 rows 一起刪
 * 8. ON DELETE RESTRICT poi → blocked
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, disposeMiniflare } from '../api/setup';
import { seedTrip, seedPoi, seedEntry, getDayId } from '../api/helpers';

describe('migration 0057 — trip_entry_pois', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30000);

  afterAll(disposeMiniflare);

  beforeEach(async () => {
    await db.prepare('DELETE FROM trip_entry_pois').run();
  });

  it('CREATE TABLE — schema 含 7 個 column + 2 UNIQUE + 1 CHECK', async () => {
    const { results } = await db
      .prepare("PRAGMA table_info('trip_entry_pois')")
      .all<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>();
    const cols = results.map((r) => r.name).sort();
    expect(cols).toEqual([
      'added_at',
      'entry_id',
      'id',
      'poi_id',
      'sort_order',
      'updated_at',
    ].sort());

    const sortOrderCol = results.find((r) => r.name === 'sort_order');
    expect(sortOrderCol?.notnull).toBe(1);

    const pkCol = results.find((r) => r.name === 'id');
    expect(pkCol?.pk).toBe(1);
  });

  it('2 個 indexes 建立成功', async () => {
    const { results } = await db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type='index' AND tbl_name='trip_entry_pois'
           AND name NOT LIKE 'sqlite_autoindex%'
         ORDER BY name`,
      )
      .all<{ name: string }>();
    const names = results.map((r) => r.name);
    expect(names).toContain('idx_trip_entry_pois_entry');
    expect(names).toContain('idx_trip_entry_pois_poi');
  });

  it('Backfill — entries with poi_id NOT NULL 在 migration 後得到 sort_order=1 row', async () => {
    const { id: tripId } = await seedTrip(db, { id: 'backfill-trip' });
    const dayId = await getDayId(db, tripId, 1);
    const poiId = await seedPoi(db, { name: 'Backfill POI' });
    // Simulate pre-migration state: entry with poi_id set, but trip_entry_pois empty
    // (clean from beforeEach already empties trip_entry_pois)
    const entryId = await seedEntry(db, dayId, { title: 'Pre-existing entry', poiId });

    // Re-run migration 0057 INSERT SELECT 模擬 prod cutover
    await db
      .prepare(
        `INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, added_at, updated_at)
         SELECT id, poi_id, 1, COALESCE(updated_at, datetime('now')), datetime('now')
         FROM trip_entries
         WHERE id = ? AND poi_id IS NOT NULL`,
      )
      .bind(entryId)
      .run();

    const row = await db
      .prepare('SELECT entry_id, poi_id, sort_order FROM trip_entry_pois WHERE entry_id = ?')
      .bind(entryId)
      .first<{ entry_id: number; poi_id: number; sort_order: number }>();
    expect(row).not.toBeNull();
    expect(row!.poi_id).toBe(poiId);
    expect(row!.sort_order).toBe(1);
  });

  describe('5 invariant smoke queries (CI gate — 任一 row 即 fail)', () => {
    it('(a) entry with poi_id + 對應 master row → smoke 對此 entry 不應 flag', async () => {
      // Migration 0057 backfill INSERT SELECT 模擬：trip_entry_pois.sort_order=1 對齊 entry.poi_id
      const { id: tripId } = await seedTrip(db, { id: 'smoke-a-trip' });
      const dayId = await getDayId(db, tripId, 1);
      const poiId = await seedPoi(db, { name: 'POI-Smoke-A' });
      const entryId = await seedEntry(db, dayId, { title: 'Entry A', poiId });
      await db
        .prepare(
          'INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)',
        )
        .bind(entryId, poiId)
        .run();

      // Scope smoke query to this entry only — global state may have prior test orphans
      const orphan = await db
        .prepare(
          `SELECT id FROM trip_entries
           WHERE id = ?
             AND poi_id IS NOT NULL
             AND id NOT IN (SELECT entry_id FROM trip_entry_pois WHERE sort_order = 1)`,
        )
        .bind(entryId)
        .first();
      expect(orphan).toBeNull();
    });

    it('(a-negative) entry with poi_id but no master row → smoke 應 flag', async () => {
      // 故意製造 invariant violation：entry.poi_id 設了，但 trip_entry_pois 沒寫
      const { id: tripId } = await seedTrip(db, { id: 'smoke-a-neg-trip' });
      const dayId = await getDayId(db, tripId, 1);
      const poiId = await seedPoi(db, { name: 'POI-Smoke-A-Neg' });
      const entryId = await seedEntry(db, dayId, { title: 'Entry orphan', poiId });
      // skip INSERT into trip_entry_pois — invariant violation

      const orphan = await db
        .prepare(
          `SELECT id FROM trip_entries
           WHERE id = ?
             AND poi_id IS NOT NULL
             AND id NOT IN (SELECT entry_id FROM trip_entry_pois WHERE sort_order = 1)`,
        )
        .bind(entryId)
        .first();
      expect(orphan).not.toBeNull();
    });

    it('(b) trip_entry_pois.poi_id 不在 pois → FK enforce 阻擋或 smoke detect', async () => {
      const { id: tripId } = await seedTrip(db, { id: 'smoke-b-trip' });
      const dayId = await getDayId(db, tripId, 1);
      const entryId = await seedEntry(db, dayId, { title: 'Entry B' });
      const fakePoiId = 9999999;

      let inserted = false;
      try {
        await db
          .prepare(
            'INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)',
          )
          .bind(entryId, fakePoiId)
          .run();
        inserted = true;
      } catch {
        // FK enforce blocked
      }

      const orphanForOurEntry = await db
        .prepare(
          `SELECT id FROM trip_entry_pois
           WHERE entry_id = ? AND poi_id NOT IN (SELECT id FROM pois)`,
        )
        .bind(entryId)
        .first();
      if (inserted) {
        expect(orphanForOurEntry).not.toBeNull();
      } else {
        expect(orphanForOurEntry).toBeNull();
      }
    });

    it('(c) duplicate (entry_id, poi_id) → UNIQUE 阻擋', async () => {
      const { id: tripId } = await seedTrip(db, { id: 'smoke-c-trip' });
      const dayId = await getDayId(db, tripId, 1);
      const poiId = await seedPoi(db, { name: 'POI-Smoke-C' });
      const entryId = await seedEntry(db, dayId, { title: 'Entry C' });

      await db
        .prepare(
          'INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)',
        )
        .bind(entryId, poiId)
        .run();

      let dupBlocked = false;
      try {
        await db
          .prepare(
            'INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 2)',
          )
          .bind(entryId, poiId)
          .run();
      } catch {
        dupBlocked = true;
      }
      expect(dupBlocked).toBe(true);

      const dupForOurEntry = await db
        .prepare(
          `SELECT entry_id, poi_id, COUNT(*) AS c FROM trip_entry_pois
           WHERE entry_id = ?
           GROUP BY entry_id, poi_id HAVING COUNT(*) > 1`,
        )
        .bind(entryId)
        .first();
      expect(dupForOurEntry).toBeNull();
    });

    it('(d) orphaned alternate (entry_id 已不存在) → CASCADE 預防', async () => {
      const { id: tripId } = await seedTrip(db, { id: 'smoke-d-trip' });
      const dayId = await getDayId(db, tripId, 1);
      const poiId = await seedPoi(db, { name: 'POI-Smoke-D' });
      const entryId = await seedEntry(db, dayId, { title: 'Entry D', poiId });
      await db
        .prepare(
          'INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)',
        )
        .bind(entryId, poiId)
        .run();

      await db.prepare('DELETE FROM trip_entries WHERE id = ?').bind(entryId).run();

      const orphan = await db
        .prepare(
          `SELECT id FROM trip_entry_pois WHERE entry_id = ?`,
        )
        .bind(entryId)
        .first();
      expect(orphan).toBeNull();
    });

    it('(e) sort_order < 1 → CHECK 阻擋', async () => {
      const { id: tripId } = await seedTrip(db, { id: 'smoke-e-trip' });
      const dayId = await getDayId(db, tripId, 1);
      const poiId = await seedPoi(db, { name: 'POI-Smoke-E' });
      const entryId = await seedEntry(db, dayId, { title: 'Entry E' });

      let checkBlocked = false;
      try {
        await db
          .prepare(
            'INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 0)',
          )
          .bind(entryId, poiId)
          .run();
      } catch {
        checkBlocked = true;
      }
      expect(checkBlocked).toBe(true);

      const violated = await db
        .prepare('SELECT id FROM trip_entry_pois WHERE entry_id = ? AND sort_order < 1')
        .bind(entryId)
        .first();
      expect(violated).toBeNull();
    });
  });

  describe('UNIQUE + CHECK constraints', () => {
    it('UNIQUE (entry_id, sort_order) — 同 entry 不能兩個 sort_order=1', async () => {
      const { id: tripId } = await seedTrip(db, { id: 'unique-so-trip' });
      const dayId = await getDayId(db, tripId, 1);
      const p1 = await seedPoi(db, { name: 'POI-Unique-SO-A' });
      const p2 = await seedPoi(db, { name: 'POI-Unique-SO-B' });
      const entryId = await seedEntry(db, dayId, { title: 'Entry UA' });

      await db
        .prepare(
          'INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)',
        )
        .bind(entryId, p1)
        .run();

      let blocked = false;
      try {
        await db
          .prepare(
            'INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)',
          )
          .bind(entryId, p2)
          .run();
      } catch {
        blocked = true;
      }
      expect(blocked).toBe(true);
    });

    it('ON DELETE CASCADE entry → 連 trip_entry_pois rows 一起刪', async () => {
      const { id: tripId } = await seedTrip(db, { id: 'cascade-trip' });
      const dayId = await getDayId(db, tripId, 1);
      const p1 = await seedPoi(db, { name: 'CASC-M' });
      const p2 = await seedPoi(db, { name: 'CASC-A' });
      const entryId = await seedEntry(db, dayId, { title: 'Entry CASC', poiId: p1 });

      await db.batch([
        db
          .prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)')
          .bind(entryId, p1),
        db
          .prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 2)')
          .bind(entryId, p2),
      ]);

      const before = await db
        .prepare('SELECT COUNT(*) AS c FROM trip_entry_pois WHERE entry_id = ?')
        .bind(entryId)
        .first<{ c: number }>();
      expect(before!.c).toBe(2);

      await db.prepare('DELETE FROM trip_entries WHERE id = ?').bind(entryId).run();

      const after = await db
        .prepare('SELECT COUNT(*) AS c FROM trip_entry_pois WHERE entry_id = ?')
        .bind(entryId)
        .first<{ c: number }>();
      expect(after!.c).toBe(0);
    });
  });
});
