-- Rollback 0089 — 把那 10 個行程改回公開
--
-- 只有在「關閉公開造成實際問題」時才用（例如某人一直靠 /trips/<id> 直接連結
-- 存取，且不方便改用 /s/:token 分享連結或加為共編者）。
--
-- ⚠ 執行後那 10 個行程會再次變成「任何人知道 tripId 就能匿名讀完整內容」，
--   包含航班編號、訂房編號與緊急聯絡人電話。優先考慮的替代做法：
--   把對方加為共編者，或改發 /s/:token 分享連結（可設到期）。
--
-- ID 與 0089 完全相同，故翻回去精確還原，不會誤開其他行程。

UPDATE trips SET published = 1 WHERE id IN (
  'okinawa-trip-2026-HuiYun',
  'okinawa-trip-2026-Ray',
  'trip-bp5o',
  'trip-me4p',
  'trip-g8we',
  'trip-f73v',
  'trip-m40m',
  'trip-692q',
  'trip-3rlt',
  'trip-is1n'
);
