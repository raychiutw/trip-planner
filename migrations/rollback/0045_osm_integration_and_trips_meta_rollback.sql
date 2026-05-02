-- Rollback for 0045 (2026-05-02)
-- Restores schema structure. Cannot recover dropped column DATA — use the
-- pre-migration `wrangler d1 export trip-planner-db --remote > backup-pre-0045.sql`
-- snapshot to restore values if needed.

-- trip_entries: DROP 3 travel cols
ALTER TABLE trip_entries DROP COLUMN travel_source;
ALTER TABLE trip_entries DROP COLUMN travel_computed_at;
ALTER TABLE trip_entries DROP COLUMN travel_distance_m;

-- pois: undo OSM cols + rename rating back + restore maps (empty)
DROP INDEX IF EXISTS idx_pois_osm;
ALTER TABLE pois DROP COLUMN data_fetched_at;
ALTER TABLE pois DROP COLUMN data_source;
ALTER TABLE pois DROP COLUMN cuisine;
ALTER TABLE pois DROP COLUMN wikidata_id;
ALTER TABLE pois DROP COLUMN osm_type;
ALTER TABLE pois DROP COLUMN osm_id;
ALTER TABLE pois ADD COLUMN maps TEXT;
ALTER TABLE pois RENAME COLUMN rating TO google_rating;

-- trip_destinations: DROP table (cascade removes index)
DROP INDEX IF EXISTS idx_trip_destinations_trip;
DROP TABLE IF EXISTS trip_destinations;

-- trips: undo new cols + restore old (without data — caller must restore from backup)
ALTER TABLE trips DROP COLUMN lang;
ALTER TABLE trips DROP COLUMN default_travel_mode;
ALTER TABLE trips DROP COLUMN data_source;

ALTER TABLE trips ADD COLUMN self_drive   INTEGER DEFAULT 0;
ALTER TABLE trips ADD COLUMN is_default   INTEGER DEFAULT 0;
ALTER TABLE trips ADD COLUMN food_prefs   TEXT;
ALTER TABLE trips ADD COLUMN footer       TEXT;
ALTER TABLE trips ADD COLUMN og_description TEXT;
ALTER TABLE trips ADD COLUMN auto_scroll  TEXT;
