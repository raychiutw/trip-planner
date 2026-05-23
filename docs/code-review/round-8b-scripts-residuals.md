# Round 8b — scripts/ HIGH residuals + selective MED/LOW

- **PR**: [#729](https://github.com/raychiutw/trip-planner/pull/729) (TBD)
- **Version**: v2.33.50
- **Date**: 2026-05-24
- **Scope**: scripts/ round 8a 後續 HIGH 收尾 + 部分 MED/LOW polish
- **Continuation of**: [round-8a-scripts-security.md](./round-8a-scripts-security.md)

## Findings handled

### HIGH

| # | Location | Issue | Status |
|---|----------|-------|--------|
| H1 | `provision-admin-cli-client.js:135` | `--rotate-secret` 不 cascade revoke `oauth_access_tokens` / `oauth_refresh_tokens` — 1h grace window 不可接受 (incident response) | ✅ Fixed: 預設 cascade revoke 兩個 token table，新 `--keep-tokens` opt-out flag for graceful rollover |
| H2 | `daily-report.js:185` | `fetch(SITE_URL + '/api/trips')` 無 auth — post v2.33.41 anonymous-read fix 後 daily-report 不再能讀 unpublished trip 列表，silent green | ✅ Fixed: mint OAuth token via `lib/get-tripline-token` + Authorization Bearer header on both `/api/trips` + `/api/trips/:id/days` fetch |

### MEDIUM

| # | Location | Issue | Status |
|---|----------|-------|--------|
| M1 | `_lib/cron-shared.ts:156` `alertTelegram` | env 缺席 silent no-op — 故障模式無 surface | ✅ Fixed: `_telegramEnvWarned` flag → `console.warn` once when env missing 或 TOKEN format 不合法 |
| M2 | `_lib/cron-shared.ts` TOKEN format | 無 validate — `.env.local` 被攻擊者寫即可注入 | ✅ Fixed: 套用 `^[0-9]+:[A-Za-z0-9_-]+$` regex (同 send-telegram.sh v2.33.49) |
| M3 | `lib/d1-client.js:24` | 5xx transient hiccup 直接 fail，daily cron 整輪 abort | ✅ Fixed: 1 retry + 500ms backoff |
| M4 | `lib/d1-client.js:38` | `JSON.stringify(json.errors || json)` json fallback 含 request body (SQL params 可能 leak to log) | ✅ Fixed: 改 `json.errors || 'unknown'` |

### Tests added (+11)

- `tests/unit/round8b-scripts-residuals.test.ts`：source-grep wiring guard for 4 fix area (provision cascade revoke / daily-report auth / cron-shared warn-once + format validate / d1-client retry + safer error)

## Round 8c follow-up（doc 列）

### HIGH 留下

| # | Location | Issue | Reason for defer |
|---|----------|-------|------------------|
| 8c1 | `dump-d1.js` + `migrate-entries-to-pois.js` + `verify-entry-poi-backfill.js` + `backfill-poi-addresses.ts` + `backfill-health-check-replies.ts` | `execSync('npx wrangler d1 execute --command "${sql}"')` SQL via shell pattern — 5 callsite refactor 到 lib/d1-client.js | 多 file refactor，需 test 路徑全 cover |
| 8c2 | `init-local-db.js:81` | String-built INSERT SQL from JSON | local-only，待 8c |
| 8c3 | `mac-mini-cron-patch/apply-patch.sh:167` | `set -a; source "$ENV_PATH"` 可 RCE via `.env` line containing `$(...)` | 改 node helper parse |

### MEDIUM 留下

(從 round-8a doc 8b section 結轉，未做)

| # | Location | Issue |
|---|----------|-------|
| 8c4 | `tripline-api-server.ts:145` | per-skill lock backward-compat 只 special-case `/tp-request` |
| 8c5 | `tripline-api-server.ts:194` | 2.5s 硬 sleep，無 readiness probe |
| 8c6 | `tripline-api-server.ts:218` | spawn 失敗無 Telegram alert |
| 8c7 | `tripline-api-server.ts:399` | log rotation 缺 |
| 8c8 | `tripline-api-server.ts:22-31` | .env parser 自家重複 (應用 lib/load-env.js) |
| 8c9 | `daily-check.js:246` | npm audit ENOBUFS |
| 8c10 | `daily-check.js:443` | LIKE hardcoded marker 用 string concat |
| 8c11 | `daily-report.js:212` | checkLinks SSRF host allowlist |
| 8c12 | `daily-report.js:303` | cleanupOldLogs retention 散落 |
| 8c13 | `google-poi-refresh-30d.ts:66` | firstCall flag 不在 finally |
| 8c14 | `dump-d1.js:50` | backup file mode 0644 含 PII |
| 8c15 | `com.tripline.api-server.plist:17` | KeepAlive unconditional |
| 8c16 | `com.tripline.api-server.plist:25` | stdout/stderr 0644 含 tokens |
| 8c17 | `init-local-db.js:93` | SQL temp file 寫在 scripts/ root |

### LOW 留下

(從 round-8a 結轉)

11 個項目見 [round-8a doc](./round-8a-scripts-security.md) 8b section LOW 表。

## Won't fix (留 rationale)

| # | Issue | Reason |
|---|-------|--------|
| W1 | provision-admin-cli secret print to stdout instruction line includes secret | Industry-standard 即使是 placeholder 顯也不會更安全；caller 該 redirect stdout if sensitive |
| W2 | `tp-check.js` R1 dead placeholder | Vestigial 但 caller 不會 break；獨立 cleanup PR |
| W3 | `memory-sync.sh` Bash 4-only | macOS 環境已 brew bash 5，CLAUDE.md 也記 platform |

## Tests summary

- 2306/2306 unit pass (+11 round 8b 新)
- Round 8a + 8b 累計 +36 scripts test (8a +25, 8b +11)
