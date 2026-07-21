-- Rollback 0090 — 清除「沿用」同意標記
--
-- 把沿用標記的帳號還原成「無同意紀錄」（NULL），例如決定改走「下次登入補問」
-- 的流程時。
--
-- 只清 `-grandfathered` 標記的列 —— 這正是 0090 刻意用獨立版本字串的好處：
-- 真實同意（`privacy_policy_version = '2026-07-20'`）不會被這支誤刪。
-- 若當初回填成與真實同意相同的值，這裡就無法區分，只能全清或全留。

UPDATE users
SET privacy_consent_at     = NULL,
    privacy_policy_version = NULL
WHERE privacy_policy_version = '2026-07-20-grandfathered';
