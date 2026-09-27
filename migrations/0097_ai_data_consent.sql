-- AI data disclosure is separate from OAuth Consent. No active disclosure is
-- seeded here: rollout requires formally approved content and version.
CREATE TABLE IF NOT EXISTS ai_data_disclosures (
  version TEXT PRIMARY KEY CHECK (length(trim(version)) > 0),
  content_json TEXT NOT NULL CHECK (
    json_valid(content_json)
    AND json_type(content_json, '$.title') = 'text'
    AND json_type(content_json, '$.processor') = 'text'
    AND json_type(content_json, '$.dataCategories') = 'array'
    AND json_array_length(content_json, '$.dataCategories') > 0
    AND json_type(content_json, '$.purpose') = 'text'
    AND json_type(content_json, '$.revocation') = 'text'
  ),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TRIGGER IF NOT EXISTS ai_data_disclosures_no_replace
BEFORE INSERT ON ai_data_disclosures
WHEN EXISTS (SELECT 1 FROM ai_data_disclosures WHERE version = NEW.version)
BEGIN SELECT RAISE(ABORT, 'AI disclosure versions are immutable'); END;
CREATE TRIGGER IF NOT EXISTS ai_data_disclosures_no_update
BEFORE UPDATE ON ai_data_disclosures
BEGIN SELECT RAISE(ABORT, 'AI disclosure versions are immutable'); END;
CREATE TRIGGER IF NOT EXISTS ai_data_disclosures_no_delete
BEFORE DELETE ON ai_data_disclosures
BEGIN SELECT RAISE(ABORT, 'AI disclosure versions are immutable'); END;
-- One pointer makes a version switch one atomic UPDATE/UPSERT, with no
-- temporary unconfigured window between deactivating and activating rows.
CREATE TABLE IF NOT EXISTS ai_data_disclosure_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_version TEXT NOT NULL REFERENCES ai_data_disclosures(version)
);

CREATE TABLE IF NOT EXISTS ai_data_consent_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version TEXT NOT NULL REFERENCES ai_data_disclosures(version),
  decision TEXT NOT NULL CHECK (decision IN ('accept', 'decline', 'revoke')),
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, request_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_data_consent_events_user_latest
  ON ai_data_consent_events(user_id, id DESC);
