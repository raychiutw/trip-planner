-- v2.33.66 round 16 MED-2: rate-limit cleanup SQL extracted from
-- .github/workflows/rate-limit-cleanup.yml inline。
-- File-based command 受 PR review (CODEOWNERS) 保護，避免 workflow-only
-- edit 偷渡 destructive SQL string。
--
-- Cutoff: window_start + 3600000ms (1h) < now_ms。對應 0035 註解，覆蓋最長
-- windowMs=1h (SIGNUP / FORGOT_PASSWORD)。鎖中 row (locked_until > now) 保留。
-- Idempotent: 重跑 0 effect。

DELETE FROM rate_limit_buckets
WHERE locked_until IS NULL
  AND window_start + 3600000 < (unixepoch() * 1000);
