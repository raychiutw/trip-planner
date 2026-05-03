-- Rollback for migration 0046: best-effort partial rollback
--
-- ## ⚠️ 限制
--
-- 此 rollback 只能還原 schema (drop new columns + recreate trip_ideas table)。
-- **資料無法還原** — trip_ideas 內容已 INSERT 進 saved_pois、原 row 已 DROP TABLE。
--
-- 真實 rollback 路徑：用 wrangler d1 time-travel restore：
--   wrangler d1 time-travel restore trip-planner-db --bookmark <pre-migration-bookmark>
--
-- 此 SQL 只供：
--   - dev 重置 local DB schema 試錯
--   - 緊急狀況 schema 必須還原但可接受資料遺失（極少見）

-- =============================================
-- 1. Drop trip_requests.actions_taken
--    SQLite 3.35+ 支援 DROP COLUMN
-- =============================================

ALTER TABLE trip_requests DROP COLUMN actions_taken;

-- =============================================
-- 2. Recreate trip_ideas table (空 table, 無資料還原)
-- =============================================

CREATE TABLE IF NOT EXISTS trip_ideas (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id               TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  poi_id                INTEGER REFERENCES pois(id) ON DELETE SET NULL,
  title                 TEXT NOT NULL,
  note                  TEXT,
  added_at              TEXT NOT NULL DEFAULT (datetime('now')),
  added_by              TEXT,
  added_by_user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  promoted_to_entry_id  INTEGER REFERENCES trip_entries(id) ON DELETE SET NULL,
  archived_at           TEXT
);

CREATE INDEX IF NOT EXISTS idx_trip_ideas_trip ON trip_ideas(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_ideas_poi ON trip_ideas(poi_id);
CREATE INDEX IF NOT EXISTS idx_trip_ideas_archived ON trip_ideas(archived_at);
CREATE INDEX IF NOT EXISTS idx_trip_ideas_added_by_user_id ON trip_ideas(added_by_user_id);

-- =============================================
-- 3. Drop trips.owner_user_id
-- =============================================

DROP INDEX IF EXISTS idx_trips_owner_user_id;
ALTER TABLE trips DROP COLUMN owner_user_id;

-- =============================================
-- 4. Reset saved_pois.user_id / trip_permissions.user_id 到 NULL
--    (這些 column 是 0033 加的，不該 drop — 只清 backfill 過的值)
-- =============================================

UPDATE saved_pois SET user_id = NULL;
UPDATE trip_permissions SET user_id = NULL;
