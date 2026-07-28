-- Rollback 0091_trip_note_ai_regeneration.sql

DROP INDEX IF EXISTS idx_trip_note_ai_jobs_active;
DROP INDEX IF EXISTS idx_trip_note_ai_jobs_request;
DROP INDEX IF EXISTS idx_trip_note_ai_jobs_trip;
ALTER TABLE trip_note_ai_jobs RENAME TO trip_note_ai_jobs_0091;

CREATE TABLE trip_note_ai_jobs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id      INTEGER NOT NULL UNIQUE REFERENCES trip_requests(id) ON DELETE CASCADE,
  trip_id         TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL CHECK(doc_type IN ('lodging-tips','tips','emergency')),
  status          TEXT NOT NULL CHECK(status IN ('pending','completed','failed')) DEFAULT 'pending',
  inserted_count  INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT
);

INSERT INTO trip_note_ai_jobs (
  id, request_id, trip_id, doc_type, status,
  inserted_count, error_message, created_at, completed_at
)
SELECT
  id, request_id, trip_id, doc_type,
  CASE
    WHEN status IN ('pending', 'processing') THEN 'pending'
    WHEN status = 'completed' THEN 'completed'
    ELSE 'failed'
  END,
  inserted_count, error_message, created_at, completed_at
FROM trip_note_ai_jobs_0091;

DROP TABLE trip_note_ai_jobs_0091;
CREATE INDEX idx_trip_note_ai_jobs_trip ON trip_note_ai_jobs(trip_id, doc_type);
CREATE INDEX idx_trip_note_ai_jobs_request ON trip_note_ai_jobs(request_id);

DROP INDEX IF EXISTS idx_trip_note_ai_exclusions_trip;
DROP INDEX IF EXISTS idx_trip_note_ai_exclusions_unique;
DROP TABLE IF EXISTS trip_note_ai_exclusions;

ALTER TABLE trip_pretrip_notes DROP COLUMN semantic_key;
ALTER TABLE trip_pretrip_notes DROP COLUMN managed_by;
ALTER TABLE trip_pretrip_notes DROP COLUMN origin;
ALTER TABLE trip_emergency_contacts DROP COLUMN semantic_key;
ALTER TABLE trip_emergency_contacts DROP COLUMN managed_by;
ALTER TABLE trip_emergency_contacts DROP COLUMN origin;
