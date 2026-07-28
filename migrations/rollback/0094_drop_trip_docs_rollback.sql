-- Rollback 0094: 重建 trip_docs + trip_doc_entries 的**空**結構。
--
-- ⚠️ 有損：資料不會回來（已由 0093 搬進 trip_pretrip_notes）。
-- 這支的用途是讓仍引用這兩張表的舊 code 能重新部署而不撞 `no such table`。
-- 真要救原始列請從 D1 time-travel bookmark 撈。

CREATE TABLE IF NOT EXISTS trip_docs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id    TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  doc_type   TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trip_doc_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id      INTEGER NOT NULL REFERENCES "trip_docs"(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  section     TEXT NOT NULL DEFAULT '',
  title       TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
