-- Rollback for migration 0063: recreate saved_pois schema
--
-- 注意：rollback 只 recreate empty schema，不 restore 2 個 historical rows。
-- 真正 recovery 路徑：D1 Time Travel (30-day retention) 從 pre-0063 backup 還原。
--
-- 此 SQL 用途：dev / staging revert 過渡，或 emergency cutback 期間補回 schema
-- 給舊 backend code 不 5xx（雖然 grep 確認 0 reads，仍保留以防 schedule code path 漏看）。

CREATE TABLE IF NOT EXISTS saved_pois (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  poi_id     INTEGER NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  saved_at   TEXT NOT NULL DEFAULT (datetime('now')),
  note       TEXT,
  UNIQUE(user_id, poi_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_pois_poi ON saved_pois(poi_id);
