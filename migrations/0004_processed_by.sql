ALTER TABLE requests ADD COLUMN processed_by TEXT DEFAULT NULL;
-- 'agent' = Agent Server 即時處理
-- 'scheduler' = tp-request 排程 fallback
