-- Rollback: 還原 requests 表為 title + body 結構，status 恢復 open/closed

-- Step 1: 建舊結構表
CREATE TABLE requests_old (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('trip-edit', 'trip-plan')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  submitted_by TEXT,
  reply TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_by TEXT DEFAULT NULL
);

-- Step 2: 遷移資料回舊格式
-- message 的第一行作為 title，其餘作為 body
INSERT INTO requests_old (id, trip_id, mode, title, body, submitted_by, reply, status, created_at, processed_by)
SELECT id, trip_id, mode,
  CASE
    WHEN instr(message, char(10)) > 0 THEN substr(message, 1, instr(message, char(10)) - 1)
    ELSE message
  END,
  CASE
    WHEN instr(message, char(10)) > 0 THEN substr(message, instr(message, char(10)) + 1)
    ELSE ''
  END,
  submitted_by, reply,
  CASE WHEN status IN ('received', 'processing', 'completed') THEN 'closed' ELSE status END,
  created_at, processed_by
FROM requests;

-- Step 3: 替換
DROP TABLE requests;
ALTER TABLE requests_old RENAME TO requests;

-- Step 4: 重建索引
CREATE INDEX idx_requests_trip_id ON requests(trip_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_trip_status ON requests(trip_id, status);
