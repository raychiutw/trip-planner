-- Rollback for migration 0065: drop trip_days.version
--
-- 注意：rollback drop column 後 OCC counter state 丟失。重新 forward migration
-- 起點 0，舊有 expectedDayVersion 全部失效（user refetch 拿到 fresh 0）。

ALTER TABLE trip_days DROP COLUMN version;
