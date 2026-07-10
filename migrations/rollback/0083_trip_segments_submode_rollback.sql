-- Rollback for 0083_trip_segments_submode.sql
--
-- Drops the nullable submode column. SQLite 3.35+（D1）支援 DROP COLUMN；submode
-- 無 index / 無 FK 依賴，drop 安全。資料損失僅限 submode 值本身（nullable 附加欄，
-- 既有 row 回 NULL，各讀取路徑皆容忍）。先 rollback 讀寫 submode 的 code，再 apply 本檔。

ALTER TABLE trip_segments DROP COLUMN submode;
