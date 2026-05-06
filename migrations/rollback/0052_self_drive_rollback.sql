-- 0052 rollback — drop self_drive cols + index
DROP INDEX IF EXISTS idx_trips_self_drive_enabled;
ALTER TABLE trips DROP COLUMN self_drive_enabled;
ALTER TABLE trips DROP COLUMN self_drive_pickup_at;
ALTER TABLE trips DROP COLUMN self_drive_return_at;
ALTER TABLE trips DROP COLUMN self_drive_pickup_location;
ALTER TABLE trips DROP COLUMN self_drive_return_location;
