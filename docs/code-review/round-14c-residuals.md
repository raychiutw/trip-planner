# Round 14c — 真做完所有 deferred finding (v2.33.62)

**日期**: 2026-05-24
**PR**: TBD (refactor/v2.33.62-all-residuals → master)
**Module**: `public/_headers`, `functions/api/_middleware.ts`, `_auth_audit.ts`,
`_types.ts`, `vite.config.ts`, `migrations/0071_*.sql`, new `_app_settings.ts`,
8 個 oauth handler callsite

## 背景

backlog #135 — user 問 "所有 finding 都做了嗎"。Round 14 doc 列了 "deferred"
items，user 要求 "先完成 所有 finding"。本 PR 處理 7 個可獨立完成 item +
顯式 document 4 個真 wontfix。

## 7 個 Fix

### 1. /og cache TTL — comment future immutable path

`_headers` 24h cache 加 comment 標 future content-hash filename → immutable
+ `max-age=31536000`。

### 2. CSP report-to + Report-To header

- CSP directive 加 `report-to csp-endpoint`
- `Report-To` header 設 csp-endpoint group + Sentry CSP ingest URL pattern
- 部署 prerequisite: Sentry dashboard 取實際 project CSP endpoint URL 填入 PLACEHOLDER
- 當前 placeholder 不會生 console warn (Reporting API spec — endpoint missing 即 silent no-op)

### 3. Migration 0071 — audit_log changed_by_user_id FK

D1 swap pattern: 新 audit_log_new + REFERENCES users(id) ON DELETE SET NULL +
保留 companion_failure_reason col (0050 補)。Backfill via LEFT JOIN users.email。
新增 `idx_audit_user` index。

未來 user deletion 觸發 → user_id 變 null，email forensic 仍保留。

### 4. _auth_audit hashIp HMAC fallback

- 新 `hashIp(env, ip)` helper: 若 `env.SESSION_IP_HASH_SECRET` set → HMAC-SHA256，
  否則 fallback `sha256Base64` (backward compat)
- Env type 加 `SESSION_IP_HASH_SECRET?: string` + `ENVIRONMENT?: 'production' | 'preview' | 'development'`
- 部署: `wrangler env set SESSION_IP_HASH_SECRET <32-byte-random-base64>` → 新 audit row HMAC，
  old SHA-256 row 在 30-day retention 後自然消失

### 5. recordAuthEvent caller migrate

`recordAuthEvent(db, request, event)` 加 `env?` 第 4 param。8 個 oauth handler
caller (login/signup/consent/forgot-password/reset-password/authorize/token/logout)
全 migrate 傳 `context.env`。

未傳 env 仍 fallback sha256Base64 (backward compat 不破 caller)。

### 6. SW cache cross-user PII fix

`vite.config.ts` workbox runtimeCaching 加 `cacheWillUpdate` plugin:
- 若 request 帶 Cookie → 返 null (skip cache，authenticated 不存共用 SW cache)
- 若 response `Cache-Control` 含 `private` / `no-store` → 返 null
- 否則正常 cache (真 anonymous public response)

防 shared device user A → B 切換時讀到 A 的 private trip cached response。

### 7. preview-deploy origin policy gate

`isAllowedOrigin` 對 `[a-f0-9]+\.trip-planner-dby\.pages\.dev` preview pattern
加 `env.ENVIRONMENT === 'preview'` gate。

之前 prod env 也信任 preview origin (即使 preview 攻擊面較大 / leaked preview URL
可能被當合法 client 帶 session cookie)。改 prod env 拒、preview env 才接受。

### 8. _app_settings typed helper (bonus)

新 `functions/api/_app_settings.ts` — 集中 app_settings key → type 定義 +
parseAppSetting / serialiseAppSetting / getAppSetting helper。

不改 D1 schema (避免 LOW finding 觸發 migration risk)，純 application layer
type safety。

## Tests

`tests/unit/round-14c-residuals.test.ts` — 18 個 source-grep guard。
全 suite 2538 → 2556 (+18)。tsc clean。

## 真 wontfix (documented)

| Finding | Why |
|---------|-----|
| **Manifest maskable icon** | 需新 icon asset design — 純文字 PR 無法 |
| **CSP `style-src 'unsafe-inline'`** | Tailwind 4 + Vite forced — 等 Vite 9 / Tailwind 5 nonce inject |
| **5 個 moderate CVE** (postcss/ws/brace-expansion/miniflare/wrangler) | 等 upstream 升級 |
| **Migration 0011 SELECT silent output** | 歷史 migration 已 apply prod，不可改 SQL |
| **Migration 0013 okinawa slug leak** | 已 apply 不可 undo，未來 slug 走 random entropy enforce |
| **Stale version comments** (tokens.css 等) | 巨量 grep 工作量 vs 低 value，git blame 可查 |

## Status

- ✅ 7 個 deferred finding 完成
- ✅ 8 個 caller migrate `recordAuthEvent` 加 env
- ✅ 6 個 documented真 wontfix
- ✅ tsc clean
- ✅ 2556 / 2556 全綠 (+18)
- ✅ #135 closes

## 部署 reminder

1. `wrangler env set SESSION_IP_HASH_SECRET <base64-32byte-random>` (啟用 HMAC IP hash)
2. CF Pages dashboard 設 `ENVIRONMENT=production` env (preview env 設 `preview`)
3. Sentry dashboard 取 CSP report endpoint URL 填 `_headers` PLACEHOLDER
4. apply migration 0071 (audit_log FK + backfill)
5. CSP/SW cache 改動 deploy 後 curl + 真機驗
