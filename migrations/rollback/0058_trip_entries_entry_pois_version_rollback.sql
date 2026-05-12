-- Rollback for migration 0058_trip_entries_entry_pois_version.sql
--
-- DROP COLUMN entry_pois_version. SQLite 3.35.0+ supports ALTER TABLE DROP COLUMN.
-- Cloudflare D1 uses libsql which supports this.
--
-- After rollback: backend regression of v2.27.0 (already deployed) will revert to
-- reading MAX(trip_entry_pois.updated_at) for entryPoisVersion — the dual-source
-- mismatch returns, but solo-user impact is bounded since round-4 alternates
-- preservation snapshot etc. don't depend on the column.

ALTER TABLE trip_entries DROP COLUMN entry_pois_version;
