// @vitest-environment node
/**
 * trip_entry_pois schema invariants（migration 0057 frozen state）
 *
 * v2.29.0: trip_entries.poi_id DROPPED；原 backfill / invariant smoke tests
 * （依賴 entries.poi_id col）已 obsolete 並移除。本 file 保留 schema regression
 * protection — CREATE TABLE shape / indexes / UNIQUE / CHECK / CASCADE。
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

  it('CREATE TABLE — schema 含 canonical columns + 2 UNIQUE + 1 CHECK', async () => {
    const { results } = await db
      .prepare("PRAGMA table_info('trip_entry_pois')")
      .all<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>();
    const cols = results.map((r) => r.name).sort();
    expect(cols).toEqual([
      'added_at',
      'description',
      'entry_id',
      'id',
      'note',
      'poi_id',
      'reservation',
      'reservation_url',
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

  describe('FK + invariant smoke queries', () => {
    it('(b) trip_entry_pois.poi_id 不在 pois → FK enforce 阻擋或 smoke detect', async () => {
      const { id: tripId } = await seedTrip(db, { id: 'smoke-b-trip' });
      const dayId = await getDayId(db, tripId, 1);
      const entryId = await seedEntry(db, dayId);
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
      const entryId = await seedEntry(db, dayId);

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
      const entryId = await seedEntry(db, dayId);
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
      const entryId = await seedEntry(db, dayId);

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
      const entryId = await seedEntry(db, dayId);

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
      const entryId = await seedEntry(db, dayId);

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
