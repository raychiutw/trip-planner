-- Rollback 0073_trip_notes.sql
-- 順序：linkage table 先（FK 指向 trips + trip_requests），data table 後
DROP INDEX IF EXISTS idx_trip_note_ai_jobs_request;
DROP INDEX IF EXISTS idx_trip_note_ai_jobs_trip;
DROP TABLE IF EXISTS trip_note_ai_jobs;

DROP INDEX IF EXISTS idx_trip_emergency_contacts_trip;
DROP TABLE IF EXISTS trip_emergency_contacts;

DROP INDEX IF EXISTS idx_trip_pretrip_notes_ai_source;
DROP INDEX IF EXISTS idx_trip_pretrip_notes_trip;
DROP TABLE IF EXISTS trip_pretrip_notes;

DROP INDEX IF EXISTS idx_trip_reservations_trip;
DROP TABLE IF EXISTS trip_reservations;

DROP INDEX IF EXISTS idx_trip_lodgings_day;
DROP INDEX IF EXISTS idx_trip_lodgings_trip;
DROP TABLE IF EXISTS trip_lodgings;

DROP INDEX IF EXISTS idx_trip_flights_trip;
DROP TABLE IF EXISTS trip_flights;
