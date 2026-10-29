-- Rollback 0097：移除 mobile OAuth callback 註冊。
--
-- ⚠️ 只還原註冊資料，不還原行為 —— 帳號刪除的近期身分驗證與 callback 政策在 code 裡，
-- 真要回到舊行為得連 code 一起 revert。
-- 已簽發、綁定這兩個 client 的 token 會失去 client，一併撤銷。

-- token / grant 的 payload 用 snake_case `client_id`，刪帳號 challenge 用 camelCase `clientId`，兩種都要比對。
DELETE FROM oauth_models
WHERE json_extract(payload, '$.client_id') IN ('tripline-mobile-uat', 'tripline-mobile-dev')
   OR json_extract(payload, '$.clientId') IN ('tripline-mobile-uat', 'tripline-mobile-dev');
DELETE FROM client_apps WHERE client_id IN ('tripline-mobile-uat', 'tripline-mobile-dev');

UPDATE client_apps
SET redirect_uris = (
      SELECT json_group_array(value) FROM json_each(client_apps.redirect_uris)
      WHERE value <> 'https://mobile-callback.trip-planner-dby.pages.dev/oauth/callback'
    ),
    updated_at = datetime('now')
WHERE client_id = 'tripline-mobile' AND json_valid(redirect_uris);
