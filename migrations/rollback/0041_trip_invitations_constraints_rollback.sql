-- Rollback 0041: trip_invitations 約束強化
--
-- **資料相容性風險**：
-- 1. UNIQUE 約束移除後，同 (trip, email) 可重新累積多筆 pending row，但既有 row
--    不會自動清理（rollback 後 application code 又是無 UNIQUE 狀態，回退到 0040）
-- 2. invited_by 從 SET NULL 改回 CASCADE — 原本 SET NULL 期間若有 user 被刪導致
--    invited_by = NULL 的 row，rollback 後 NOT NULL 會 fail
--
-- **Boundary**：rollback 前手動處理 invited_by IS NULL 的 row：
--   DELETE FROM trip_invitations WHERE invited_by IS NULL;
--
-- 之後同樣 recreate-swap pattern 改回 0040 schema。

PRAGMA foreign_keys = OFF;

-- WARNING：先確認沒有 invited_by IS NULL 的 row，否則 INSERT NOT NULL 會 fail
-- 若有需先手動 DELETE 或 backfill

CREATE TABLE trip_invitations_new (
  token_hash    TEXT PRIMARY KEY,
  trip_id       TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member')),
  invited_by    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at    TEXT NOT NULL,
  accepted_at   TEXT,
  accepted_by   TEXT REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO trip_invitations_new (
  token_hash, trip_id, invited_email, role, invited_by,
  created_at, expires_at, accepted_at, accepted_by
)
SELECT token_hash, trip_id, invited_email, role, invited_by,
       created_at, expires_at, accepted_at, accepted_by
FROM trip_invitations
WHERE invited_by IS NOT NULL;

DROP TABLE trip_invitations;
ALTER TABLE trip_invitations_new RENAME TO trip_invitations;

CREATE INDEX idx_invitations_email ON trip_invitations(invited_email);
CREATE INDEX idx_invitations_trip ON trip_invitations(trip_id);
CREATE INDEX idx_invitations_pending ON trip_invitations(trip_id, accepted_at) WHERE accepted_at IS NULL;

PRAGMA foreign_keys = ON;
