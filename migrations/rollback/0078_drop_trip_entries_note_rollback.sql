-- Rollback for migration 0078: recreate trip_entries.note column
--
-- 注意：rollback 補回 nullable note column，但「原始值無法還原」——0078 backfill 已把
-- entry-level note 併進 master trip_entry_pois.note，DROP 後原欄位值不存在。補回的 column
-- 全為 NULL。
--
-- 此 SQL 用途：dev / staging revert 過渡，或 emergency cutback 期間補回 schema 給舊 backend
-- code 不 5xx（舊 backend 仍 INSERT/SELECT trip_entries.note）。若需 forensic 還原原值，
-- 走 D1 Time Travel。

ALTER TABLE trip_entries ADD COLUMN note TEXT;
