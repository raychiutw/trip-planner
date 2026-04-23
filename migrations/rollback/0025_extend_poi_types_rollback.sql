-- Rollback for migration 0025: 移除 'activity' 從 pois.type CHECK
--
-- 執行時機：僅當 Phase 1 ship 後發現需回退 type 擴充。
-- 前置：
--   1. 確保 pois 表無 type='activity' 的資料
--      SELECT COUNT(*) FROM pois WHERE type='activity';
--      若 > 0 先 STOP（否則 INSERT 會 CHECK fail）
--   2. 確認 0025 已實際 apply 過（避免 no-op rollback 損壞 schema）
--   3. 若 0026 已 apply，請先執行 0026_trip_entries_poi_id_rollback.sql
--      否則本 script 的 RENAME pois → pois_old 會把 trip_entries.poi_id
--      的 FK 連帶重寫指向 pois_old，DROP pois_old 後變 dangling FK。
--
-- Pattern：同 0025 triple-rename swap，連 poi_relations 一起回退
-- （單 rebuild pois 會 leave dangling FK → pois_old）。

ALTER TABLE pois RENAME TO pois_old;

CREATE TABLE pois (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT NOT NULL CHECK (type IN ('hotel','restaurant','shopping','parking','attraction','transport','other')),
  name          TEXT NOT NULL,
  description   TEXT,
  note          TEXT,
  address       TEXT,
  phone         TEXT,
  email         TEXT,
  website       TEXT,
  hours         TEXT,
  google_rating REAL,
  category      TEXT,
  maps          TEXT,
  mapcode       TEXT,
  lat           REAL,
  lng           REAL,
  country       TEXT DEFAULT 'JP',
  source        TEXT DEFAULT 'ai',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO pois SELECT * FROM pois_old;

ALTER TABLE trip_pois RENAME TO trip_pois_old;

CREATE TABLE trip_pois (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id             TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  poi_id              INTEGER NOT NULL REFERENCES pois(id),
  context             TEXT NOT NULL CHECK (context IN ('hotel','timeline','shopping')),
  day_id              INTEGER REFERENCES trip_days(id) ON DELETE CASCADE,
  entry_id            INTEGER REFERENCES trip_entries(id) ON DELETE CASCADE,
  sort_order          INTEGER DEFAULT 0,
  description         TEXT,
  note                TEXT,
  hours               TEXT,
  checkout            TEXT,
  breakfast_included  INTEGER,
  breakfast_note      TEXT,
  price               TEXT,
  reservation         TEXT,
  reservation_url     TEXT,
  must_buy            TEXT,
  source              TEXT DEFAULT 'ai',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (context = 'hotel' AND day_id IS NOT NULL) OR
    (context IN ('timeline','shopping') AND (entry_id IS NOT NULL OR day_id IS NOT NULL))
  )
);

INSERT INTO trip_pois SELECT * FROM trip_pois_old;

ALTER TABLE poi_relations RENAME TO poi_relations_old;

CREATE TABLE poi_relations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  poi_id          INTEGER NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  related_poi_id  INTEGER NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  relation_type   TEXT NOT NULL CHECK (relation_type IN ('parking','nearby')),
  note            TEXT,
  UNIQUE(poi_id, related_poi_id, relation_type)
);

INSERT INTO poi_relations SELECT * FROM poi_relations_old;

DROP TABLE poi_relations_old;
DROP TABLE trip_pois_old;
DROP TABLE pois_old;

CREATE INDEX idx_pois_type ON pois(type);
CREATE INDEX idx_pois_name ON pois(name);
CREATE INDEX idx_pois_country ON pois(country);
CREATE UNIQUE INDEX idx_pois_name_type ON pois(name, type);

CREATE INDEX idx_trip_pois_trip ON trip_pois(trip_id);
CREATE INDEX idx_trip_pois_poi ON trip_pois(poi_id);
CREATE INDEX idx_trip_pois_day ON trip_pois(day_id);
CREATE INDEX idx_trip_pois_entry ON trip_pois(entry_id);
