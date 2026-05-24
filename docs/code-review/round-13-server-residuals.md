# Round 13 — src/server/ deferred MEDIUM 全部完成 (v2.33.59)

**日期**: 2026-05-24
**PR**: TBD (refactor/v2.33.59-round-12-residuals → master)
**Module**: `functions/api/oauth/` + `src/server/` + `src/pages/` + main route
**LOC**: ~600 行 (含新 SPA page + helper + test)

## 背景

backlog #132 — Round 12 doc 留下 6 個 MEDIUM defer。User 2026-05-24 逐項討論
後選擇「全部做」。本 PR 一次處理。

## 6 個 Fix

### 1. PUBLIC_ORIGIN env (Host header trust)

**問題**: `verify` / `forgot-password` / `send-verification` / `permissions` / `_id_token`
用 `new URL(context.request.url).origin` 拼 email 連結 / OIDC issuer。
若 attacker 變造 Host header → email link 可能變成 javascript: URL（CF Pages 一般
邊緣 normalise 但 zero-trust 不假設）。

**Fix**: `Env.PUBLIC_ORIGIN?` + `getPublicOrigin(env, request)` helper。
5 個 callsite 全 migrate。fallback to request.url.origin 若 env 未設（dev 漸進）。

### 2. PKCE mandatory for confidential clients

**問題**: `validate-authorize-request.ts` 只對 `client_type='public'` 強制 PKCE。
OAuth 2.1 §4.1.1 規範所有 client 都該有 — 對 confidential 防 client_secret 偷
+ code intercept 雙重攻擊組合。

**Fix**: 拔掉 client_type 分支，PKCE 對所有 client 一律強制 + S256-only。
test 對齊更新 (VALID_REQUEST 加 PKCE，flip confidential-without-PKCE 期望值)。

### 3. HMAC HKDF domain separation

**問題**: `session.ts` 跟 `invitation-token.ts` 共用 SESSION_SECRET 直接 HMAC。
雖然 message 輸入結構不同無 collision，但 crypto hygiene best practice 是各 protocol
用 derived sub-key — 未來新增 HMAC 用途也安全。

**Fix**:
- 新 `src/server/hkdf.ts` `deriveSubSecret(masterSecret, info)` — RFC 5869 HKDF-SHA256
- `session.ts` sign 用 `derived = deriveSubSecret(SECRET, 'session_v1')`
- `session.ts` verify 雙路徑 backward compat (新 derived → fallback raw)，
  30 天 session TTL 後可拔
- `invitation-token.ts` 用 `derived = deriveSubSecret(SECRET, 'invitation_token_v1')`。
  TTL 7 天 → 7 天後 backward compat 不需要，直接 cutover

### 4. Unicode email NFKC normalize

**問題**: 6 處 `email.toLowerCase()` 對 Turkish `İ` / homograph / 全形 ＠ 不 normalize。
同 user 不同輸入路徑 (signup vs invite) 拿到不同字串 → 比對失敗 (UX broken)
或 silent 接受似似名 email (security weak)。

**Fix**:
- 新 `src/server/email-utils.ts` `normalizeEmail(email)` — NFKC + toLowerCase
- 6 callsite migrate: `invitation-accept` (3 處 compare + INSERT), `permissions`
  (3 處 lowerEmail / auth lookup), `invitations/accept` (audit), `_middleware` (2 處)

### 5. forgot-password / send-verification waitUntil (anti-enum timing)

**問題**: 2026-05-02 「私人圈可接受」放棄 anti-enum，sync `await sendEmail()` ~1000ms。
Attacker 可 timing 觀察 known vs unknown email response 差 (~20ms vs ~1000ms)。

**Fix**:
- 兩處 endpoint 改 `context.waitUntil((async () => { ... sendEmail + audit ... })())`
- 主 handler 立即返 `genericResponse` ~20ms 不論 email 存在與否
- 失敗 silent (audit + telegram alert)，user 看不到 specific error 但 ops 仍可 monitor
- 拔掉 sync `EMAIL_SEND_FAILED 500 response`

Trade-off: 之前「誠實回 500」UX 變 silent，但 anti-enum > 失敗訊息透明度。

### 6. verify endpoint POST + landing page (H2)

**問題**: `/api/oauth/verify?token=...` 是 GET-with-side-effect。User 點 email 連結 →
browser GET → server 改 `email_verified_at` + token 消耗 → 302 /login。
3 個攻擊面: Referer leak token / image-preload silent consume / browser history。

**Fix**:
- `verify.ts` 加 `onRequestPost` (primary)，返 JSON `{ ok }` / `{ error: 'expired'|'used'|... }`
- `verify.ts` `onRequestGet` 保留 30+ 天 backward compat (已寄出 email)
- 全 response 加 `Referrer-Policy: no-referrer` header
- 共用 `consumeVerifyToken(env, token)` helper 避免 duplicate logic
- 新 SPA page `src/pages/VerifyEmailPage.tsx` (auto-POST + status UI + no-JS fallback button)
- `main.tsx` route table 加 `/auth/verify-email`
- `send-verification.ts` verifyUrl 從 `/api/oauth/verify?token=` 改 `/auth/verify-email?token=`

User 互動: 點 email link → SPA page 1.5s 顯示「驗證中…→ ✓ 成功」→ 自動跳轉 /login?verified=1。
失敗顯示對應錯誤訊息 + retry / login / 回首頁 button。

## Tests

`tests/unit/round-13-server-residuals.test.ts` — 25 個 source-grep guard 涵蓋 6 fix。
全 suite 2478 → 2504 (+26)。tsc clean。

## Status

- ✅ 6 個 Round 12 defer 全部完成
- ✅ tsc clean
- ✅ 2504 / 2504 全綠 (+26)
- ✅ #132 closes
