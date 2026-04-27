-- Rollback 0040: trip_invitations
--
-- **資料損失警告：**
-- 1. 所有 pending invitation 立即失效（pending 邀請者點 link 收 410）
-- 2. 已接受的 invitation audit trail 消失（trip_permissions 仍在但無「誰邀請、何時、
--    用什麼 token」紀錄）
-- 3. 已產的 raw token 永遠 orphan（無對應 token_hash 可比對）
--
-- **強烈建議**：rollback 前先備份資料：
--   wrangler d1 export trip-planner-db --remote --table trip_invitations > backup.sql
--
-- **In-flight request 警告**：deploy boundary 期間若 client 已寄出 POST /api/invitations/
-- accept，table drop 後該 request 會 500。考慮先把 endpoint 下線 / 回 503 一段時間再 drop。
--
-- Boundary：rollback 前必須先 deploy 不再 reference trip_invitations 的 code
--   - functions/api/permissions.ts POST 改回「直接 INSERT trip_permissions」
--   - functions/api/invitations*.ts 全部移除
--   - InvitePage / signup invitationToken 路徑下線

DROP INDEX IF EXISTS idx_invitations_email;
DROP INDEX IF EXISTS idx_invitations_trip;
DROP INDEX IF EXISTS idx_invitations_pending;
DROP TABLE IF EXISTS trip_invitations;
