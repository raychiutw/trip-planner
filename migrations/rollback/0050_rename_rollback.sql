-- Migration 0050 rollback
--
-- Reverts: rename saved_pois → poi_favorites + companion_request_actions + audit_log column
--
-- 注意：本 migration 是 expand-contract phase 1，saved_pois 在 forward migration 期間仍存在。
-- 若 deploy 後 5 min 內 5xx > 1% 觸發 rollback，code revert 後會走回讀 saved_pois（dual-read
-- 邏輯保證），因此 rollback 主要是清理新建 schema artifacts。
--
-- Order: 反向 forward sequence — 先 DROP companion_request_actions 與其 index、再 DROP
-- poi_favorites 與其 index、最後 DROP audit_log column。

DROP INDEX IF EXISTS idx_companion_request_actions_request;
DROP TABLE IF EXISTS companion_request_actions;

DROP INDEX IF EXISTS idx_poi_favorites_poi;
DROP TABLE IF EXISTS poi_favorites;

-- audit_log.companion_failure_reason DROP COLUMN
-- D1 SQLite 3.42+ 支援 ALTER TABLE DROP COLUMN（SQLite 3.35+ 標準）。
-- 若 fail 表示底層版本不支援，fallback 為 backup-restore pattern（見 0047 precedent）。
ALTER TABLE audit_log DROP COLUMN companion_failure_reason;
