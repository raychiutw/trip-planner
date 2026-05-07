-- 0053 rollback — drop trip_segments + indexes
DROP INDEX IF EXISTS idx_trip_segments_to;
DROP INDEX IF EXISTS idx_trip_segments_from;
DROP INDEX IF EXISTS idx_trip_segments_trip;
DROP TABLE IF EXISTS trip_segments;
