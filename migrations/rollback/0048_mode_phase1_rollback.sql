-- Rollback for migration 0048 phase 1
--
-- ⚠️ Best-effort schema-only：post-phase-1 mode=NULL rows 用 COALESCE→'trip-plan'
-- backfill；不可接受時改用 `wrangler d1 time-travel restore` 到 pre-0048 bookmark。

DROP TABLE IF EXISTS trip_requests_old;

CREATE TABLE trip_requests_old (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('trip-edit', 'trip-plan')),
  message TEXT NOT NULL,
  submitted_by TEXT,
  reply TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'processing', 'completed', 'failed')),
  actions_taken TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT NULL,
  processed_by TEXT DEFAULT NULL CHECK(processed_by IN ('api', 'job') OR processed_by IS NULL)
);

INSERT INTO trip_requests_old (id, trip_id, mode, message, submitted_by, reply, status, actions_taken, created_at, updated_at, processed_by)
SELECT id, trip_id, COALESCE(mode, 'trip-plan'), message, submitted_by, reply, status, actions_taken, created_at, updated_at, processed_by
FROM trip_requests;

DROP TABLE trip_requests;
ALTER TABLE trip_requests_old RENAME TO trip_requests;

CREATE INDEX idx_trip_requests_trip_id ON trip_requests(trip_id);
CREATE INDEX idx_trip_requests_status ON trip_requests(status);
CREATE INDEX idx_trip_requests_trip_status ON trip_requests(trip_id, status);
CREATE INDEX idx_trip_requests_stale ON trip_requests(status, updated_at);
