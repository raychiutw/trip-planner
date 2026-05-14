-- Rollback for migration 0064: recreate mode_source column
--
-- 注意：rollback 重建 col 但所有 row 都會是 default='auto'，原本 user 改過的
-- segment 喪失 'user' 標記。若需 forensic 還原，走 D1 Time Travel。
--
-- 此 SQL 用途：dev / staging revert 過渡，或 emergency cutback 期間補回 schema
-- 給舊 backend code 不 5xx。

ALTER TABLE trip_segments ADD COLUMN mode_source TEXT NOT NULL DEFAULT 'auto';
