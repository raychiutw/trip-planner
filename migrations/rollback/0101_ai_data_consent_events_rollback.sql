-- 0101 rollback：移除 AI 資料同意事件表（純新增的表，沒有其他表依賴它）。
-- ⚠️ 會刪除所有同意／撤回的稽核紀錄；回滾前先確認三個受管制入口的閘門旗標 AI_CONSENT_ENFORCED 已關閉，
--    且舊入口與新 api 已部署到不讀這張表的版本，否則 GET/POST /api/account/ai-data-consent 會 500。
DROP INDEX IF EXISTS idx_ai_data_consent_user_id;
DROP TABLE IF EXISTS ai_data_consent_events;
