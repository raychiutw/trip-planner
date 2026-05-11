-- Rollback for migration 0057_trip_entry_pois.sql (v2.27.0 multi-POI per entry)
--
-- Phase 1 is additive: 0057 adds trip_entry_pois junction table + 2 indexes,
-- backfills from trip_entries.poi_id, but does NOT drop poi_id column. So
-- rollback is data-loss-free for entry→POI relationships (still dual-written
-- to trip_entries.poi_id during the Phase 1 transition window).
--
-- Order matters: drop indexes before table (SQLite handles auto-drop but
-- being explicit aids forensic reading + matches convention 0049/0051/0054).
--
-- Use case: production regression demands revert of v2.27.0 backend before
-- Phase 2 migration 0058 lands. After this rollback runs, all entry→POI
-- relationships still readable from trip_entries.poi_id by pre-v2.27.0 code.

DROP INDEX IF EXISTS idx_trip_entry_pois_poi;
DROP INDEX IF EXISTS idx_trip_entry_pois_entry;
DROP TABLE IF EXISTS trip_entry_pois;
