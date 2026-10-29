-- Rollback 0097：移除 mobile OAuth callback 註冊。
--
-- ⚠️ 只還原註冊資料，不還原行為 —— 帳號刪除的近期身分驗證與 callback 政策在 code 裡，
-- 真要回到舊行為得連 code 一起 revert。
-- 已簽發、綁定這兩個 client 的 token 會失去 client，一併撤銷。
--
-- ⚠️ rollback 分不出「0097 新增的」與「營運端先前就有的」：同 client_id 的列與該 callback URI 一律移除
-- （forward 為了不覆蓋營運端資料而略過的那些，rollback 也會刪）。執行前先確認 prod 沒有營運端自行登記的同名 client。
-- 另外 OAuthState 暫存列（`$.reauth.clientId`，5 分鐘 TTL）不比對，自行過期。

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
