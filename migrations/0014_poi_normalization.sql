-- POI 正規化：建立 pois master + trip_pois fork 引用
-- 同時統一 entries 欄位名（body→description, rating→google_rating）

-- 1. POI master 表（跨行程共用 source of truth）
CREATE TABLE IF NOT EXISTS pois (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT NOT NULL CHECK (type IN ('hotel','restaurant','shopping','parking','attraction','transport','other')),
  name          TEXT NOT NULL,
  description   TEXT,
  address       TEXT,
  phone         TEXT,
  email         TEXT,
  website       TEXT,
  hours         TEXT,
  google_rating REAL,
  category      TEXT,
  maps          TEXT,
  mapcode       TEXT,
  location_json TEXT,
  meta_json     TEXT,
  country       TEXT DEFAULT 'JP',
  source        TEXT DEFAULT 'ai',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pois_type ON pois(type);
CREATE INDEX IF NOT EXISTS idx_pois_name ON pois(name);
CREATE INDEX IF NOT EXISTS idx_pois_country ON pois(country);

-- 2. 行程 POI 引用（fork — 可覆寫欄位）
CREATE TABLE IF NOT EXISTS trip_pois (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id       TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  poi_id        INTEGER NOT NULL REFERENCES pois(id),
  context       TEXT NOT NULL CHECK (context IN ('hotel','timeline','shopping')),
  day_id        INTEGER REFERENCES days(id) ON DELETE CASCADE,
  entry_id      INTEGER REFERENCES entries(id) ON DELETE CASCADE,
  sort_order    INTEGER DEFAULT 0,
  description   TEXT,
  note          TEXT,
  hours         TEXT,
  source        TEXT DEFAULT 'ai',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (context = 'hotel' AND day_id IS NOT NULL) OR
    (context IN ('timeline','shopping') AND (entry_id IS NOT NULL OR day_id IS NOT NULL))
  )
);

CREATE INDEX IF NOT EXISTS idx_trip_pois_trip ON trip_pois(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_pois_poi ON trip_pois(poi_id);
CREATE INDEX IF NOT EXISTS idx_trip_pois_day ON trip_pois(day_id);
CREATE INDEX IF NOT EXISTS idx_trip_pois_entry ON trip_pois(entry_id);

-- 3. entries 欄位統一
ALTER TABLE entries RENAME COLUMN body TO description;
ALTER TABLE entries RENAME COLUMN rating TO google_rating;
