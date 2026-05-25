-- v2.33.107: trip_invitations 30 天 cleanup（兌現 migration 0040 註解承諾）。
--
-- 對齊 auth_audit_log + session_devices 的 cleanup 模式 — 同 GitHub Actions
-- cron + wrangler d1 execute --remote pattern（沿 cleanup-rate-limit.sql）。
--
-- Cleanup 規則：
--   1. accepted_at IS NOT NULL AND accepted_at < now − 30 天
--      → 已接受邀請保留 30 天當 audit trail（追蹤 invitation→permission flow），過期清掉
--   2. accepted_at IS NULL AND expires_at < now − 30 天
--      → 未接受且過期 30+ 天，使用者顯然不會回來點 link，DELETE
--
-- Pending (accepted_at IS NULL AND expires_at >= now) rows 保留 — 邀請者仍可
-- 在 CollabPanel 看到 pending invitations。
--
-- Idempotent: 重跑 0 effect。

DELETE FROM trip_invitations
WHERE (accepted_at IS NOT NULL AND accepted_at < datetime('now', '-30 days'))
   OR (accepted_at IS NULL AND expires_at < datetime('now', '-30 days'));
