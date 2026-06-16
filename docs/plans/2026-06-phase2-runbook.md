# Phase 2 執行 runbook — 移除全域 admin（rotate + cron 切 ops scope）

**前置**：Phase 1 已上 prod（v2.55.5, 2026-06-16），soak ≥1hr ✓。Phase 2 改 `scripts/`（mac mini cron，不經 CF Pages deploy）+ 不可逆 rotate prod token。所有 fix 點已 grep 確認（見下）。

## 關鍵 ordering（先讀，否則斷 cron）

**token request 的 scope 必須 ⊆ client allowed_scopes**。所以 cron scope **不能**硬 request ops scope（client 未 rotate 前沒 ops scope → 拿不到 token → cron 全斷）。

解法：cron 改「**不傳 scope → token endpoint 自動給 client allowed_scopes**」（rotate 前 admin、rotate 後 ops，自動適配，無需 code/rotate 同步）。**待驗證**：`functions/api/oauth/token.ts` 對無 scope 的 client_credentials grant 是否給 allowed_scopes（get-tripline-token.js:24 註解說會，但 :94 code 硬寫 'admin' 與註解矛盾 — Build 前先讀 token.ts 確認）。

## Code 改動（scripts/，一個 PR）

### 1. F2 — provision cascade-revoke（`scripts/provision-admin-cli-client.js:130-158`）
現狀：`:130` 先 `DELETE client_apps` → `:141/146` `DELETE oauth_access_tokens/oauth_refresh_tokens`（**兩表不存在** → execD1 throw → catch 吞成 warning → 撤銷 silent no-op，舊 token 活到 1h）。
修：(a) **把 token revoke 移到 client_apps DELETE 之前**（hard-fail safe）；(b) 打對表
```sql
DELETE FROM oauth_models WHERE name IN ('AccessToken','RefreshToken') AND json_extract(payload, '$.client_id') = ?
```
（payload client key = `client_id` snake，確認自 `oauth/token.ts:101` `{ client_id: clientId, ... }` + `_middleware.ts:18` `interface AccessTokenPayload { client_id: string }`）；(c) **移除 try/catch → hard-fail**（execD1 throw 往上 → main().catch exit 1；此時 client_apps 未刪、新 secret 未發，舊狀態完整）。

### 2. provision allowedScopes（`:169`）
`'["admin","trips:read","trips:write","companion"]'` → `'["ops:maps","ops:poi","ops:cache","ops:trips:read","companion"]'`（去 admin/trips:*）。

### 3. cron scope（`scripts/lib/get-tripline-token.js:94` + `scripts/_lib/cron-shared.ts:102`）
兩處 `|| 'admin'` default 移除。get-tripline-token.js:96-101 URLSearchParams 改「有 TRIPLINE_API_SCOPES 才 set scope，否則不傳」（不能傳 undefined → URLSearchParams 變 'undefined' 字串）：
```js
const body = new URLSearchParams({ grant_type:'client_credentials', client_id:clientId, client_secret:clientSecret });
const scopes = process.env.TRIPLINE_API_SCOPES;
if (scopes) body.set('scope', scopes);
```
cron-shared.ts:102 `mintToken(env, scopes='admin')` → default 改不傳 scope（同上邏輯）。

### 4. cron PATH（`scripts/tripline-api-server.ts:567-568`，獨立 infra bug，順手修）
- `:567` `scheduleDailyScript(4, 0, 'node', ['scripts/auth-cleanup.js'], 'auth-cleanup')` — `'node'` launchd PATH 找不到 → 改絕對路徑（用 :142 tmux 那種 candidates `/opt/homebrew/bin/node` || `process.execPath`）。
- `:568` `scheduleDailyScript(4, 30, '/Users/ray/.bun/bin/bun', ['run','refresh:google'], 'google-poi-refresh')` — `/Users/ray/.bun/bin/bun` 不存在（bun 移到 homebrew）→ 改 candidates `/opt/homebrew/bin/bun` || `/Users/ray/.bun/bin/bun`。

走 /simplify → /tp-code-verify + /review → /cso --diff → /ship。

## 運維（rotate，不可逆，code ship + mac mini pull 後）

硬順序：
1. ship code（F2+scope+cron PATH）→ master → **mac mini `git pull`**（scripts/ 改動生效）
2. `node scripts/provision-admin-cli-client.js --rotate-secret`（用修好的 F2，撤銷**真生效**；client 新 allowed_scopes = ops）→ 印新 `TRIPLINE_API_CLIENT_SECRET`
3. 更新 **`.env.local`** 的 `TRIPLINE_API_CLIENT_SECRET`（get-tripline-token.js loadEnvLocal 讀此；非 plist）
4. 清 token 快取 `rm /tmp/tripline-cli-token-*.json`（強制重抓 ops token）
5. 重啟 api-server：`launchctl kickstart -k gui/$(id -u)/com.tripline.api-server`
6. **驗證**：(a) 舊 token 打 `/api/admin/maps-settings` → 401（撤銷生效）；(b) 手動跑一個 cron（如 daily-check）→ 拿新 ops token → 維運 endpoint 200；(c) 今晚 20:00 daily-check/quota-monitor + 04:00/04:30 auth-cleanup/refresh:google 全綠。

rotate 可行性已確認：`.env.local` 有 `CLOUDFLARE_API_TOKEN` + `CF_ACCOUNT_ID` + `TRIPLINE_API_CLIENT_SECRET`（這台是 mac mini）；provision script 還需 `D1_DATABASE_ID`（Build 前確認在 .env.local 或 wrangler.toml）。

## 完成後 → Phase 3
移除雙接受（`hasOpsScope` 的 `|| scopes.includes('admin')`）+ `AuthData.isAdmin`（40 檔）+ `ADMIN_EMAIL` + per-trip `role='admin'` migration + 刪 test-alert。
