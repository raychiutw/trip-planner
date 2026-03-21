-- Migration 0010: days table — date/day_of_week/label NOT NULL DEFAULT ''
-- SQLite 不支援 ALTER COLUMN ADD NOT NULL，採 recreate table 策略

PRAGMA foreign_keys = OFF;

-- Step 1: 先把現有 null 值補上預設（安全網，正式環境已手動修復）
UPDATE days SET date = '' WHERE date IS NULL;
UPDATE days SET day_of_week = '' WHERE day_of_week IS NULL;
UPDATE days SET label = '' WHERE label IS NULL;

-- Step 2: Recreate table with NOT NULL DEFAULT ''
CREATE TABLE days_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id         TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_num         INTEGER NOT NULL,
  date            TEXT NOT NULL DEFAULT '',
  day_of_week     TEXT NOT NULL DEFAULT '',
  label           TEXT NOT NULL DEFAULT '',
  weather_json    TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(trip_id, day_num)
);

-- Step 3: Copy data
INSERT INTO days_new (id, trip_id, day_num, date, day_of_week, label, weather_json, updated_at)
SELECT id, trip_id, day_num, date, day_of_week, label, weather_json, updated_at FROM days;

-- Step 4: Drop old, rename new
DROP TABLE days;
ALTER TABLE days_new RENAME TO days;

-- Step 5: Recreate index
CREATE INDEX IF NOT EXISTS idx_days_trip ON days(trip_id);
