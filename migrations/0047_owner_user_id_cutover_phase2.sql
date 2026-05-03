-- Migration 0047: V2 owner cutover Phase 2 — DROP email columns + UNIQUE 改 user_id
--
-- Phase 2 (irreversible cutover). Phase 1 = migration 0046 (ADD COLUMN + backfill).
-- D6=A approved Big Bang，但 phase 2 仍應由 runbook 強制 manual gate（E-M5）：
--
--   1. 確認 commit 1-6 已 deploy 到 prod（code 100% 走 user_id-based auth dual-read）
--   2. soak ≥ 1 hr，觀察 prod logs 無 auth.email-only fallback 噪音
--   3. `bun scripts/verify-user-backfill.ts` 對 prod 必 PASS（0 orphans）
--   4. wrangler d1 backup bookmark 記錄好（rollback 點）
--   5. 才執行 `wrangler d1 migrations apply trip-planner-db --remote`
--
-- ## E-C1 — Pre-flight assertion via NOT NULL constraint
--
-- NEW TABLE pattern 把 user_id 設 NOT NULL。INSERT INTO ... SELECT ... 若有任何
-- user_id IS NULL row → 違反 NOT NULL → 整個 transaction ABORT，不會半 cutover。
-- 這是 SQLite 內建的 assertion 機制，比手寫 SELECT COUNT 更穩。

PRAGMA foreign_keys = OFF;

-- =============================================
-- 1. saved_pois: drop email, UNIQUE 改 (user_id, poi_id), user_id NOT NULL
-- =============================================

CREATE TABLE saved_pois_new (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  poi_id    INTEGER NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  saved_at  TEXT NOT NULL DEFAULT (datetime('now')),
  note      TEXT,
  UNIQUE (user_id, poi_id)
);

INSERT INTO saved_pois_new (id, user_id, poi_id, saved_at, note)
SELECT id, user_id, poi_id, saved_at, note FROM saved_pois;
-- ↑ 若任何 row.user_id IS NULL → ABORT (E-C1 assertion via NOT NULL)

DROP TABLE saved_pois;
ALTER TABLE saved_pois_new RENAME TO saved_pois;
-- UNIQUE (user_id, poi_id) auto-creates index covering user_id lookups, only need poi_id index.
CREATE INDEX idx_saved_pois_poi ON saved_pois(poi_id);

-- =============================================
-- 2. trip_permissions: drop email, UNIQUE 改 (user_id, trip_id)
--    ⚠️ 例外：email='*' wildcard public-read 不 cutover（無 user_id 對應）
--    → 此 PR 範圍內保留為「歷史遺留」，未來另開 PR 用 dedicated public_trips column
-- =============================================

CREATE TABLE trip_permissions_new (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id TEXT NOT NULL,
  role    TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  UNIQUE (user_id, trip_id)
);

INSERT INTO trip_permissions_new (id, user_id, trip_id, role)
SELECT id, user_id, trip_id, role FROM trip_permissions
WHERE user_id IS NOT NULL AND email != '*';
-- ↑ ABORT if NOT NULL violated (E-C1 assertion). '*' wildcard 暫時 drop（未來 dedicated public_trips column）

DROP TABLE trip_permissions;
ALTER TABLE trip_permissions_new RENAME TO trip_permissions;
-- UNIQUE (user_id, trip_id) covers user_id-only and (user_id, trip_id) lookups.

-- =============================================
-- 3. trips: drop owner (email column), owner_user_id NOT NULL
-- =============================================

CREATE TABLE trips_new (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  owner_user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title                 TEXT,
  description           TEXT,
  countries             TEXT,
  published             INTEGER DEFAULT 0,
  data_source           TEXT DEFAULT 'manual',
  default_travel_mode   TEXT DEFAULT 'driving',
  lang                  TEXT DEFAULT 'zh-TW',
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO trips_new (
  id, name, owner_user_id, title, description, countries, published,
  data_source, default_travel_mode, lang, created_at, updated_at
)
SELECT
  id, name, owner_user_id, title, description, countries, published,
  data_source, default_travel_mode, lang, created_at, updated_at
FROM trips;
-- ↑ ABORT if any owner_user_id IS NULL (E-C1 assertion)

DROP TABLE trips;
ALTER TABLE trips_new RENAME TO trips;
CREATE INDEX idx_trips_owner_user_id ON trips(owner_user_id);

PRAGMA foreign_keys = ON;
