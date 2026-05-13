// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, disposeMiniflare } from '../api/setup';
import { seedTrip, seedPoi, seedEntry, getDayId } from '../api/helpers';

async function run0059DataCutover(db: D1Database) {
  await db.prepare('DROP TABLE IF EXISTS _m0059_canonical_entry_pois').run();
  await db.prepare(`
    CREATE TABLE _m0059_canonical_entry_pois AS
    WITH affected_entries AS (
      SELECT DISTINCT entry_id
      FROM trip_pois
      WHERE context = 'timeline'
        AND entry_id IS NOT NULL
        AND poi_id IS NOT NULL
    ),
    combined AS (
      SELECT
        tp.entry_id,
        tp.poi_id,
        0 AS source_rank,
        COALESCE(tp.sort_order, 0) AS source_order,
        tp.id AS source_id,
        datetime('now') AS added_at,
        datetime('now') AS updated_at,
        tp.description,
        tp.note,
        tp.reservation,
        tp.reservation_url
      FROM trip_pois tp
      WHERE tp.context = 'timeline'
        AND tp.entry_id IS NOT NULL
        AND tp.poi_id IS NOT NULL

      UNION ALL

      SELECT
        tep.entry_id,
        tep.poi_id,
        1 AS source_rank,
        tep.sort_order AS source_order,
        tep.id AS source_id,
        tep.added_at,
        tep.updated_at,
        tep.description,
        tep.note,
        tep.reservation,
        tep.reservation_url
      FROM trip_entry_pois tep
      JOIN affected_entries ae ON ae.entry_id = tep.entry_id
    ),
    deduped AS (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY entry_id, poi_id
          ORDER BY source_rank, source_order, source_id
        ) AS poi_rank
      FROM combined
    ),
    ranked AS (
      SELECT
        entry_id,
        poi_id,
        ROW_NUMBER() OVER (
          PARTITION BY entry_id
          ORDER BY source_rank, source_order, source_id
        ) AS sort_order,
        added_at,
        updated_at,
        description,
        note,
        reservation,
        reservation_url
      FROM deduped
      WHERE poi_rank = 1
    )
    SELECT * FROM ranked
  `).run();

  await db.prepare(`
    DELETE FROM trip_entry_pois
    WHERE entry_id IN (SELECT DISTINCT entry_id FROM _m0059_canonical_entry_pois)
  `).run();

  await db.prepare(`
    INSERT INTO trip_entry_pois (
      entry_id,
      poi_id,
      sort_order,
      added_at,
      updated_at,
      description,
      note,
      reservation,
      reservation_url
    )
    SELECT
      entry_id,
      poi_id,
      sort_order,
      added_at,
      updated_at,
      description,
      note,
      reservation,
      reservation_url
    FROM _m0059_canonical_entry_pois
    ORDER BY entry_id, sort_order
  `).run();

  await db.prepare(`
    UPDATE trip_entries
    SET
      poi_id = (
        SELECT tep.poi_id
        FROM trip_entry_pois tep
        WHERE tep.entry_id = trip_entries.id
          AND tep.sort_order = 1
      ),
      entry_pois_version = entry_pois_version + 1
    WHERE id IN (SELECT DISTINCT entry_id FROM _m0059_canonical_entry_pois)
  `).run();

  await db.prepare(`
    DELETE FROM trip_pois
    WHERE context = 'timeline'
  `).run();
  await db.prepare('DROP TABLE _m0059_canonical_entry_pois').run();
}

describe('migration 0059 — canonical entry POI cutover', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30000);

  afterAll(disposeMiniflare);

  beforeEach(async () => {
    await db.prepare('DELETE FROM trip_pois').run();
    await db.prepare('DELETE FROM trip_entry_pois').run();
  });

  it('moves timeline trip_pois into ordered trip_entry_pois and deletes old rows', async () => {
    const { id: tripId } = await seedTrip(db, { id: 'm0059-trip' });
    const dayId = await getDayId(db, tripId, 1);
    const wrapperPoi = await seedPoi(db, { name: '午餐 wrapper', type: 'attraction' });
    const firstPoi = await seedPoi(db, { name: '正選餐廳', type: 'restaurant' });
    const secondPoi = await seedPoi(db, { name: '備選餐廳', type: 'restaurant' });
    const existingAlt = await seedPoi(db, { name: '既有備選', type: 'restaurant' });
    const entryId = await seedEntry(db, dayId, { title: '午餐', poiId: wrapperPoi });

    await db.batch([
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)').bind(entryId, wrapperPoi),
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 2)').bind(entryId, existingAlt),
      db
        .prepare("INSERT INTO trip_pois (poi_id, trip_id, context, entry_id, day_id, sort_order, reservation, note) VALUES (?, ?, 'timeline', ?, ?, 0, ?, ?)")
        .bind(firstPoi, tripId, entryId, dayId, '已訂位', '靠窗'),
      db
        .prepare("INSERT INTO trip_pois (poi_id, trip_id, context, entry_id, day_id, sort_order) VALUES (?, ?, 'timeline', ?, ?, 1)")
        .bind(secondPoi, tripId, entryId, dayId),
      db
        .prepare("INSERT INTO trip_pois (poi_id, trip_id, context, entry_id, day_id, sort_order) VALUES (?, ?, 'timeline', NULL, ?, 99)")
        .bind(existingAlt, tripId, dayId),
    ]);

    await run0059DataCutover(db);

    const rows = await db
      .prepare('SELECT poi_id, sort_order, reservation, note FROM trip_entry_pois WHERE entry_id = ? ORDER BY sort_order')
      .bind(entryId)
      .all<{ poi_id: number; sort_order: number; reservation: string | null; note: string | null }>();
    expect(rows.results.map((row) => [row.poi_id, row.sort_order])).toEqual([
      [firstPoi, 1],
      [secondPoi, 2],
      [wrapperPoi, 3],
      [existingAlt, 4],
    ]);
    expect(rows.results[0]!.reservation).toBe('已訂位');
    expect(rows.results[0]!.note).toBe('靠窗');

    const entry = await db.prepare('SELECT poi_id, entry_pois_version FROM trip_entries WHERE id = ?').bind(entryId).first<{ poi_id: number; entry_pois_version: number }>();
    expect(entry!.poi_id).toBe(firstPoi);
    expect(entry!.entry_pois_version).toBe(1);

    const oldRows = await db.prepare("SELECT COUNT(*) AS c FROM trip_pois WHERE context = 'timeline'").first<{ c: number }>();
    expect(oldRows!.c).toBe(0);
  });
});
