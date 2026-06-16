-- Rollback for migration 0080: re-widen trip_permissions.role CHECK to include 'admin'
--
-- 注意：rollback 補回 CHECK 的 'admin' 合法值，但「原本哪些 row 是 admin 無法還原」——
-- 0080 已把 4 個 role='admin' downgrade 成 'member'，該資訊不存在。補回後這些 row 仍是
-- 'member'。若需 forensic 還原原值，走 D1 Time Travel。
--
-- 此 SQL 用途：dev / staging revert 過渡，或 emergency cutback 期間補回 schema 給舊 backend
-- code 不 5xx（舊 permissions.ts 仍接受並 INSERT role='admin'）。
--
-- trip_permissions 無 children FK（見 0047:75），標準 swap 安全。

DROP TABLE IF EXISTS trip_permissions_new;
CREATE TABLE trip_permissions_new (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id TEXT NOT NULL,
  role    TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  UNIQUE (user_id, trip_id)
);

INSERT INTO trip_permissions_new (id, user_id, trip_id, role)
SELECT id, user_id, trip_id, role FROM trip_permissions;

DROP TABLE trip_permissions;
ALTER TABLE trip_permissions_new RENAME TO trip_permissions;

ANALYZE trip_permissions;
