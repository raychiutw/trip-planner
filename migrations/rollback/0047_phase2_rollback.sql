-- Rollback for migration 0047 (phase 2): irreversible without backup restore
--
-- ## ⚠️ DROP COLUMN 不可逆（資料層）
--
-- Phase 2 已移除 saved_pois.email / trip_permissions.email / trips.owner 欄位。
-- 此 rollback 只 schema 層 recreate，**email 欄位資料無法還原** — 必須走
-- wrangler d1 time-travel restore：
--
--   wrangler d1 time-travel restore trip-planner-db --bookmark <pre-0047-bookmark>
--
-- ## 此 SQL 用途
--
-- 開發 / 緊急狀況下只還原 schema 結構（資料 NULL）。Prod 不該跑此 rollback；
-- 應該用 time-travel。

PRAGMA foreign_keys = OFF;

-- =============================================
-- 1. saved_pois: re-add email column + drop UNIQUE constraint difference
-- =============================================

CREATE TABLE saved_pois_old (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  email     TEXT,
  poi_id    INTEGER NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  saved_at  TEXT NOT NULL DEFAULT (datetime('now')),
  note      TEXT,
  user_id   TEXT REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (email, poi_id)
);

-- email 必須從 users JOIN 取（資料層 best-effort 還原）
INSERT INTO saved_pois_old (id, email, poi_id, saved_at, note, user_id)
SELECT sp.id,
       COALESCE((SELECT email FROM users WHERE id = sp.user_id), ''),
       sp.poi_id,
       sp.saved_at,
       sp.note,
       sp.user_id
FROM saved_pois sp;

DROP TABLE saved_pois;
ALTER TABLE saved_pois_old RENAME TO saved_pois;
CREATE INDEX idx_saved_pois_email ON saved_pois(email);
CREATE INDEX idx_saved_pois_poi ON saved_pois(poi_id);
CREATE INDEX idx_saved_pois_user_id ON saved_pois(user_id);

-- =============================================
-- 2. trip_permissions: re-add email
-- =============================================

CREATE TABLE trip_permissions_old (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  email   TEXT NOT NULL,
  trip_id TEXT NOT NULL,
  role    TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (email, trip_id)
);

INSERT INTO trip_permissions_old (id, email, trip_id, role, user_id)
SELECT tp.id,
       COALESCE((SELECT email FROM users WHERE id = tp.user_id), ''),
       tp.trip_id,
       tp.role,
       tp.user_id
FROM trip_permissions tp;

DROP TABLE trip_permissions;
ALTER TABLE trip_permissions_old RENAME TO trip_permissions;
CREATE INDEX idx_permissions_email ON trip_permissions(email);
CREATE INDEX idx_trip_permissions_user_id ON trip_permissions(user_id);

-- =============================================
-- 3. trips: re-add owner column
-- =============================================

CREATE TABLE trips_old (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  owner                 TEXT,
  owner_user_id         TEXT REFERENCES users(id) ON DELETE RESTRICT,
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

INSERT INTO trips_old (
  id, name, owner, owner_user_id, title, description, countries, published,
  data_source, default_travel_mode, lang, created_at, updated_at
)
SELECT
  t.id, t.name,
  COALESCE((SELECT email FROM users WHERE id = t.owner_user_id), ''),
  t.owner_user_id,
  t.title, t.description, t.countries, t.published,
  t.data_source, t.default_travel_mode, t.lang, t.created_at, t.updated_at
FROM trips t;

DROP TABLE trips;
ALTER TABLE trips_old RENAME TO trips;
CREATE INDEX idx_trips_owner_user_id ON trips(owner_user_id);

PRAGMA foreign_keys = ON;
