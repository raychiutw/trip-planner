-- 回滾 0098：移除 $.user_id 的表達式索引（只影響帳號抹除的效能，不影響正確性）。
DROP INDEX IF EXISTS idx_oauth_models_user_id;
