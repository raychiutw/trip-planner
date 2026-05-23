# Round 8c — scripts/ final polish (HIGH + MED)

- **PR**: [#730](https://github.com/raychiutw/trip-planner/pull/730) (TBD)
- **Version**: v2.33.51
- **Date**: 2026-05-24
- **Scope**: scripts/ round 8 sweep 收尾 — 處理 HIGH RCE / .env dedup / MED polish
- **Continuation of**: [round-8a](./round-8a-scripts-security.md) + [round-8b](./round-8b-scripts-residuals.md)
- **Closes**: scripts/ review entirely + **Round 8 整體**

## Findings handled

### HIGH

| # | Location | Issue | Status |
|---|----------|-------|--------|
| H1 | `mac-mini-cron-patch/apply-patch.sh:167` | `set -a; source "$ENV_PATH"; set +a` — `.env` line containing `$(...)` 即 RCE | ✅ Fixed: 改 node helper parse with key shell-safe regex + 0600 mode stat check before parse |
| H2 | `tripline-api-server.ts:22-31` | inline `.env` parser drift from `lib/load-env.js` (不 strip outer quote / 不 validate key) | ✅ Fixed: quote strip 雙+單 + key validate 對齊 sister scripts |

### MEDIUM

| # | Location | Issue | Status |
|---|----------|-------|--------|
| M1 | `dump-d1.js:30` | backup dir 含 PII (users 表)，default mode 0755 | ✅ Fixed: mkdirSync mode 0o700 + chmodSync defense + 個別 JSON file mode 0o600 |
| M2 | `daily-check.js:246` | npm audit execSync 無 maxBuffer → ENOBUFS on heavy deps | ✅ Fixed: maxBuffer 32MB |
| M3 | `google-poi-refresh-30d.ts:67` | `firstCall = false` 只在 success path → 第一個 POI 拋 non-401 後第二個 401 即誤觸 "first-call 401" alert | ✅ Fixed: 搬進 `finally` block |

## Tests added (+10)

- `tests/unit/round8c-scripts-polish.test.ts` — source-grep wiring guard for 5 fix area。

## Round 8 closure 完整 finding tracking

### Round 8a (#728, v2.33.49) — 6 fixes + 25 tests
- CRITICAL: api-server skillCommand allowlist
- 5 HIGH: env quote strip / unreachable exit 1 / parser drift x2 / smoke set -e
- MED: telegram TOKEN format validate
- +25 tests: d1-client.js 14 + round8a wiring 11

### Round 8b (#729, v2.33.50) — 6 fixes + 11 tests
- 2 HIGH: provision cascade revoke / daily-report auth
- 4 MED: cron-shared alertTelegram warn + format validate / d1-client retry + safer error
- +11 tests: round8b wiring

### Round 8c (#730, v2.33.51) — 5 fixes + 10 tests
- 2 HIGH: apply-patch RCE / api-server .env dedup
- 3 MED: dump-d1 backup PII perms / daily-check ENOBUFS / google-poi firstCall finally
- +10 tests: round8c wiring

**Total round 8**: 1 CRITICAL + 8 HIGH + 7 MED + 46 tests across 3 PRs。

## Round 8d/backlog（剩餘 LOW + 部分 MED）

### HIGH still deferred

| # | Location | Issue | Reason |
|---|----------|-------|--------|
| 8d1 | `dump-d1.js` / `migrate-entries-to-pois.js` / `verify-entry-poi-backfill.js` / `backfill-poi-addresses.ts` / `backfill-health-check-replies.ts` | `execSync('npx wrangler d1 execute --command "${sql}"')` 5 callsite SQL via shell | One-shot backfill scripts mostly done。dump-d1 still ran weekly — could refactor next |
| 8d2 | `init-local-db.js:81` | String-built INSERT SQL from JSON backfill | local-only，dev-tool scope |

### MEDIUM 留下 (round 8d)

| # | Location | Issue |
|---|----------|-------|
| 8d3 | `tripline-api-server.ts:145` | per-skill lock backward-compat |
| 8d4 | `tripline-api-server.ts:194` | 2.5s hardcoded sleep — 應加 readiness probe |
| 8d5 | `tripline-api-server.ts:218` | spawn 失敗無 Telegram alert |
| 8d6 | `tripline-api-server.ts:399` | log rotation 缺 |
| 8d7 | `daily-check.js:443` | LIKE hardcoded marker pattern |
| 8d8 | `daily-report.js:212` | checkLinks SSRF host allowlist |
| 8d9 | `daily-report.js:303` | cleanupOldLogs retention 散落 |
| 8d10 | `com.tripline.api-server.plist:17` | KeepAlive ThrottleInterval |
| 8d11 | `com.tripline.api-server.plist:25` | stdout/stderr 0644 含 tokens |
| 8d12 | `init-local-db.js:93` | SQL temp file 寫在 scripts/ root |

### LOW 11 items 列在 round-8a doc 8b section

## Won't fix (from agent suggestions)

| # | Issue | Reason |
|---|-------|--------|
| W1 | provision PBKDF2 100k vs OWASP 600k | Workers CPU budget 限制；後續 Workers Paid 升級時 bump，留 TODO |
| W2 | `tp-check.js` R1 placeholder | Vestigial pass()，不影響 caller |
| W3 | `memory-sync.sh` Bash 4-only | macOS 已 brew bash 5 |
| W4 | `provision` print secret instruction line | Industry-standard placeholder 不增安全；caller 自負責 redirect |

## Tests summary

- 2316/2316 unit pass (+10 round 8c)
- Round 8 累計 +46 scripts test (8a +25, 8b +11, 8c +10)
