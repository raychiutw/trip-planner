-- Rollback 0037: session_devices
--
-- 回滾 V2-P6 multi-device session tracking。**資料損失**：所有 active session
-- 的 device row 消失 → /settings/sessions 頁面變空清單，且 logout 觸發的
-- revocation 會失效（cookie 仍會 cleared，但若 token 還沒過期會「復活」）。
--
-- 部署 boundary：
--   - rollback 前先 deploy 不再 reference session_devices 的 code，否則
--     issueSession / clearSession / revokeAllOtherSessions 會 500
--   - 或先暫停 /api/account/sessions GET / DELETE 端點（feature flag）

DROP INDEX IF EXISTS idx_session_devices_user_active;
DROP TABLE IF EXISTS session_devices;
