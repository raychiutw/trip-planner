-- Rollback 0036: auth_audit_log
--
-- 回滾 V2-P6 audit log table。**資料損失**：所有歷史 auth event (signup /
-- login / logout / token_issue / oauth_authorize 等) 全部消失，30 天 retention
-- 後本來就會被 cron 清，但「rollback 後再 forensic」會看不到事件。
--
-- 與 V2-P6 部署 boundary 順序：
--   - rollback 此 migration 前必須先 deploy 不再 reference auth_audit_log 的 code
--     （否則 recordAuthEvent INSERT 會 500），或同時容忍 best-effort fail（_auth_audit.ts 的 try/catch 已處理）。

DROP INDEX IF EXISTS idx_auth_audit_user_time;
DROP INDEX IF EXISTS idx_auth_audit_client_time;
DROP INDEX IF EXISTS idx_auth_audit_event_outcome;
DROP INDEX IF EXISTS idx_auth_audit_time;
DROP TABLE IF EXISTS auth_audit_log;
