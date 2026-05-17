-- Rollback for 0068_drop_dead_trip_fields.sql
--
-- Adds back 6 dead columns as nullable. Data loss — original values not preserved.
-- 因 columns 本身 dead data，rollback 等於空白 column，沒實際救援價值；保留為 schema parity。

ALTER TABLE trips ADD COLUMN default_travel_mode TEXT;
ALTER TABLE trips ADD COLUMN self_drive_enabled INTEGER;
ALTER TABLE trips ADD COLUMN self_drive_pickup_at TEXT;
ALTER TABLE trips ADD COLUMN self_drive_return_at TEXT;
ALTER TABLE trips ADD COLUMN self_drive_pickup_location TEXT;
ALTER TABLE trips ADD COLUMN self_drive_return_location TEXT;
