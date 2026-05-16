-- Rollback for 0066_drop_pois_mapcode.sql
-- Re-adds mapcode column (nullable). Original values are NOT restored.
ALTER TABLE pois ADD COLUMN mapcode TEXT;
