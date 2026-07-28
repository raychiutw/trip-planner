-- Rollback 0095: 把三筆幽靈設定寫回去。
--
-- ⚠️ 只還原資料形狀，**不還原行為** —— 讀取端（maps-settings API / quota-monitor /
-- daily-check）已在同一支 PR 移除，門檻寫死在 scripts/lib/google-maps-quota.js。
-- 真要回到舊行為得連 code 一起 revert。
--
-- 值沿用清除前的實測值（budget 200 是那筆 2025-03 就取消的抵免）。

INSERT OR REPLACE INTO app_settings (key, value) VALUES
  ('google_maps_budget_usd', '200'),
  ('google_maps_lock_threshold_pct', '90'),
  ('google_maps_unlock_threshold_pct', '50');
