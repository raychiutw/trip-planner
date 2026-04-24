-- Rollback 0030: trip_entries.order_in_day
--
-- 回滾 ALTER TABLE ADD COLUMN order_in_day。
-- SQLite 3.35+ / D1 支援原生 DROP COLUMN，但須先 DROP 相關 INDEX。
-- 資料損失：所有 entry 的 order_in_day 值消失（Phase 5 前皆為 default 0，
-- 無有效排序資料；Phase 5 後若已 backfill 則此 rollback 會丟失 drag 排序）。

DROP INDEX IF EXISTS idx_trip_entries_order;
ALTER TABLE trip_entries DROP COLUMN order_in_day;
