-- Rollback for migration 0026: 移除 trip_entries.poi_id 欄位
--
-- 執行時機：僅當 Phase 1 ship 後發現 schema 問題。
-- 前置：確保無 API / script 已寫入 poi_id（Phase 2 前不應有）
-- 先跑：SELECT COUNT(*) FROM trip_entries WHERE poi_id IS NOT NULL;
-- 若 > 0，說明有未預期寫入，**先停止 rollback** 檢查來源
--
-- SQLite 不支援 ALTER DROP COLUMN（< 3.35），需 table rebuild。
-- D1 可能支援（SQLite 3.45+），但為 safety 仍用 rebuild pattern。

ALTER TABLE trip_entries RENAME TO trip_entries_old;

CREATE TABLE trip_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  day_id          INTEGER NOT NULL REFERENCES trip_days(id) ON DELETE CASCADE,
  sort_order      INTEGER NOT NULL,
  time            TEXT,
  title           TEXT NOT NULL,
  description     TEXT,
  source          TEXT DEFAULT 'ai',
  maps            TEXT,
  mapcode         TEXT,
  google_rating   REAL,
  note            TEXT,
  travel_type     TEXT,
  travel_desc     TEXT,
  travel_min      INTEGER,
  location        TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO trip_entries (
  id, day_id, sort_order, time, title, description, source, maps, mapcode,
  google_rating, note, travel_type, travel_desc, travel_min, location, updated_at
)
SELECT
  id, day_id, sort_order, time, title, description, source, maps, mapcode,
  google_rating, note, travel_type, travel_desc, travel_min, location, updated_at
FROM trip_entries_old;

DROP TABLE trip_entries_old;

-- trip_entries 無其他 index 要重建（原本只有 PK）
