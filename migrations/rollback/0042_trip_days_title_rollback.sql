-- Rollback 0042: 移除 trip_days.title column
--
-- SQLite 不支援 DROP COLUMN before 3.35，但 Cloudflare D1 ≥ 3.40 支援。
-- 若 title 已寫入 user data 慎用此 rollback，會永久刪除 day title content。

ALTER TABLE trip_days DROP COLUMN title;
