-- v2.42.0 (C3): purge orphaned cloned trips.
--
-- A clone whose connect-root rollback partially failed can leave a `trips` row
-- (data_source='cloned') with NO owner permission — rollbackTrip deletes
-- trip_permissions before the trips row, so a mid-rollback failure orphans the trip.
-- Such a trip is unreachable/invisible (no owner). Delete cloned trips >1 day old that
-- have no permission row; FK ON DELETE CASCADE purges their children.
--
-- NOT EXISTS (not NOT IN) so an empty trip_permissions can never match everything.
-- The >1-day grace avoids racing an in-flight clone (which writes trip + permission in
-- the same first batch). Idempotent.
DELETE FROM trips
WHERE data_source = 'cloned'
  AND created_at < datetime('now', '-1 day')
  AND NOT EXISTS (SELECT 1 FROM trip_permissions tp WHERE tp.trip_id = trips.id);
