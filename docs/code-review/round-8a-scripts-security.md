# Round 8a — scripts/ HIGH security + critical test gap

- **PR**: [#728](https://github.com/raychiutw/trip-planner/pull/728) (TBD)
- **Version**: v2.33.49
- **Date**: 2026-05-24
- **Scope**: scripts/ — 38 files / ~4,552 LOC（最後一個 module）
- **Agents**: code-reviewer + security-auditor + test-engineer

## Findings handled in this PR

### CRITICAL

| # | Location | Issue | Status |
|---|----------|-------|--------|
| C1 | `tripline-api-server.ts:88` | `sessionPrefixForSkill` 只 lowercase + 拔 `/`，無嚴格驗證 — 未來 PR 把 skill 暴露給 HTTP query 即 shell-quote / command injection | ✅ Fixed: 新 `ALLOWED_SKILLS` Set + `assertAllowedSkill()` 在 3 個 entry point gate (sessionPrefixForSkill / spawnTmuxRequest / processLoop) |

### HIGH

| # | Location | Issue | Status |
|---|----------|-------|--------|
| H1 | `tripline-job.sh:22` | 原始 `.env.local` parser 不 strip 外層 quote → `TRIPLINE_API_SECRET="foo"` 被原樣 export 為 `"foo"` (含 quote) → curl 401 | ✅ Fixed: strip 外層 double/single quotes + 加 key shell-safe regex validate |
| H2 | `tripline-job.sh:99` | API server unreachable 時 `exit 0` mask outage → launchd 看不到 error、Telegram 不 alert | ✅ Fixed: 改 `exit 1` |
| H3 | `lib/get-tripline-token.js:41` | Legacy regex parser `/^(\w+)=(.+)/` 不處理 value with `=` (base64/JWT)、不 strip quotes — 與 sister script drift silent fail | ✅ Fixed: 改用 shared `loadEnvLocal()` from `./load-env` |
| H4 | `_lib/cron-shared.ts:35` | 同樣 drift — 只 strip 雙引號，不 strip 單引號，跟 lib/load-env.js parser 不一致 | ✅ Fixed: 雙/單 quote 都 strip + 加 key validate |
| H5 | `smoke/poi-favorites-rename-post-deploy.sh:14` | `set -uo pipefail` 缺 `-e` — 寫 prod D1 INSERT 後 partial failure 不 abort → leak orphan rows | ✅ Fixed: `set -euo pipefail` |

### MEDIUM (security)

| # | Location | Issue | Status |
|---|----------|-------|--------|
| M1 | `lib/send-telegram.sh:32` | `${TOKEN}` unquoted interpolate into curl URL — 攻擊者寫 `.env.local` 可 inject query string redirect | ✅ Fixed: validate `TOKEN` matches `^[0-9]+:[A-Za-z0-9_-]+$` + `CHAT_ID` numeric only |

### Tests added (+25)

- `tests/unit/d1-client-script.test.ts` (+14) — test-engineer **CRITICAL gap**：scripts/lib/d1-client.js 5 個 callers 共用但**零測試**。守 getConfig env validation / queryD1 SELECT path (results array / empty / params binding) / execD1 INSERT path (meta.changes / DDL defensive) / failure path / Authorization header / URL composition / rawQuery low-level.
- `tests/unit/round8a-scripts-security.test.ts` (+11) — source-grep guard 6 個 fix wiring (skillCommand allowlist / env quote strip / token helper shared loadEnvLocal / cron-shared quote-strip / smoke set -e / telegram TOKEN validation)

## Round 8b/8c follow-up（doc 列）

### HIGH 留下 round

| # | Location | Issue | Defer reason |
|---|----------|-------|--------------|
| 8b1 | `provision-admin-cli-client.js:135` | `--rotate-secret` 不 cascade revoke `oauth_access_tokens` — 1h grace window 不可接受 | DB 操作需多 statement，獨立 PR |
| 8b2 | `daily-report.js:185` | `fetch(SITE_URL + '/api/trips')` 無 auth — post v2.33.41 anonymous-read fix 後該 endpoint require auth | 需 mint token via `lib/get-tripline-token.js`，獨立 PR |
| 8b3 | `dump-d1.js` / `migrate-entries-to-pois.js` / `verify-entry-poi-backfill.js` / `backfill-poi-addresses.ts` / `backfill-health-check-replies.ts` | `execSync('npx wrangler d1 execute --command "${sql}"')` SQL via shell pattern — 多 callsite | 多 file refactor，獨立 PR |
| 8b4 | `init-local-db.js:81` | String-built INSERT SQL — local DB only 風險低，但 backfill 從 JSON 仍可 SQL inject local | local-only，優先級低 |
| 8b5 | `mac-mini-cron-patch/apply-patch.sh:167` | `set -a; source "$ENV_PATH"` — `.env` line 含 `$(...)` 即 RCE | 需 parse via node helper |

### MEDIUM 留下 round

| # | Location | Issue |
|---|----------|-------|
| 8b6 | `tripline-api-server.ts:145` | per-skill lock backward-compat 只 special-case `/tp-request` |
| 8b7 | `tripline-api-server.ts:194` | 2.5s 硬 sleep before send-keys，無 readiness probe |
| 8b8 | `tripline-api-server.ts:218` | spawn 失敗無 Telegram alert |
| 8b9 | `tripline-api-server.ts:399` | log file 無 rotation |
| 8b10 | `tripline-api-server.ts:22-31` | 自家 .env 解析重複 `lib/load-env.js` |
| 8b11 | `lib/d1-client.js:24` | 5xx 無 retry |
| 8b12 | `_lib/cron-shared.ts:143` | `alertTelegram` silent no-op without env (應 console.warn) |
| 8b13 | `daily-check.js:246` | `queryNpmAudit` 無 maxBuffer → ENOBUFS |
| 8b14 | `daily-check.js:443` | LIKE clause string interpolation (hardcoded markers，但 pattern 危險) |
| 8b15 | `daily-report.js:212` | `checkLinks` SSRF surface — 加 host allowlist |
| 8b16 | `daily-report.js:303` | `cleanupOldLogs` retention 散落各 script — 集中常量 |
| 8b17 | `google-poi-refresh-30d.ts:66` | `firstCall` flag 不在 finally |
| 8b18 | `dump-d1.js:50` | backup file mode 0o644 含 PII，應 0o600 |
| 8b19 | `com.tripline.api-server.plist:17` | `KeepAlive` unconditional — 應加 ThrottleInterval backoff |
| 8b20 | `com.tripline.api-server.plist:25` | stdout/stderr `0o644` world-readable，內含 token mint errors |
| 8b21 | `init-local-db.js:93` | SQL temp file 寫在 scripts/ root 而非 /tmp |

### LOW 留下 round

| # | Location | Issue |
|---|----------|-------|
| 8b22 | `tripline-api-server.ts:88` | `sessionPrefixForSkill` 不驗 non-empty (allowlist guard 後實際多餘) |
| 8b23 | `tripline-job.sh:73` | 卡住 ID curl response 沒 track per-rid status |
| 8b24 | `migrate-launchd-to-cowork.sh:27` | `sudo rm -f` 未驗 file ownership |
| 8b25 | `daily-check.js:382` | stderr.log 8KB tail 路徑信任 `s.name` |
| 8b26 | `daily-check.js:100` | Sentry org/project 不 encodeURIComponent |
| 8b27 | `daily-report.js:67` | CF GraphQL accountTag interpolation |
| 8b28 | `provision-admin-cli-client.js:96-103` | PBKDF2 100k iterations 低於 OWASP 600k |
| 8b29 | `provision-admin-cli-client.js:179` | 「Verify with:」instruction 直接列 secret in copy paste cmd |
| 8b30 | `qa-email-flows.sh:66` | hardcoded admin email — 改 env-driven |
| 8b31 | `memory-sync.sh:22` | Bash 4-only `${BASH_REMATCH[1]^^}` macOS 默 bash 3.2 |
| 8b32 | `tp-check.js:13` | dead code R1 placeholder + meta.foodPreferences 等 stale references |

### Other test gaps (低優先)

| Script | Reason |
|--------|--------|
| `_lib/cron-shared.ts` | 154 LOC OAuth token cache + leadtime — round 8b 補 |
| `lib/google-maps-quota.js` | 部分 cover via `telegram-msg-google-maps.test.ts`，缺 threshold helper direct test |
| `lib/build-daily-check-msg.js` | 129 LOC 部分 cover |
| `daily-report.js` | 557 LOC 整體 untested (e2e 可 cover) |
| `verify-entry-poi-backfill.js` | 66 LOC migration verification |
| `cleanup-test-data-leak.js` | 98 LOC，已有 dry-run 安全 default，e2e 可 cover |
| `provision-admin-cli-client.js` | 184 LOC，one-time provision，low frequency |

## Won't fix (留 rationale)

| # | Location | Issue | Reason |
|---|----------|-------|--------|
| W1 | `lib/get-tripline-token.js:81` | Token cache file mode 0o600 | Already correct — positive observation |
| W2 | `auth-cleanup.js` | DELETE not in transaction | 已加 inline comment，retention sweep 無 consistency invariant |
| W3 | All inline `<style>` in scripts/.sh | Bash here-doc 內 — non-script files | N/A scripts directory |

## Positive observations

- `tripline-api-server.ts:265` constant-time bearer comparison — 正確的 length short-circuit + XOR over TextEncoder bytes
- `lib/mailer-handler.ts:100` `isPlainEmail` 拒絕 CRLF / 逗號分隔 / display-name — 防 open-relay 開門
- `check-migration-safety.sh` 把 2026-05-04 incident lesson 變成 pre-deploy gate，清晰 remediation message
- per-skill lock refactor (v2.33.27) 設計正確
- `_lib/cron-shared.ts` token caching 跟 helper script 用同 `cachePath` shape — cache coherence
- Token cache file mode 0o600 (per-uid filename)
- `backup-prod-d1.sh` 明確 exclude log tables (disk vs recoverability tradeoff documented)
- `mailer-handler.ts` 已 DI testable (`makeMailHandler({ verifyAuth, transporter, log })`)
- `cleanup-test-data-leak.js` defaults to dry-run，需 `--no-dry-run` 才寫
- `qa-email-flows.sh` 驗 base URL + admin email allowlist 防誤觸發

## Round 8 closure plan

- **Round 8a (this PR)**: 1 CRITICAL + 5 HIGH + 1 MED security + 25 test ✅
- **Round 8b**: 5 HIGH (provision rotate / daily-report auth / execSync refactor 多檔 / init-local-db / apply-patch source) — 各自有 surgery scope
- **Round 8c**: remaining MED + LOW + Test gaps

Round 8a 完成 — task #115 marked completed only after 8b/8c ship。
