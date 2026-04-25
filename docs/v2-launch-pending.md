# V2 Launch — 尚未完成項目（Code + Ops）

> 最後更新 2026-04-25 — V2 Identity sprint code 範圍 100% 完成（PR #287-#306），
> 此文件統整**尚未做但須在 V2 prod launch 前處理**的工作。
>
> **參考：**
> - [`docs/v2-oauth-server-plan.md`](v2-oauth-server-plan.md) — 原 V2 設計（autoplan 37+ findings）
> - [`docs/v2-p5-p6-p7-roadmap.md`](v2-p5-p6-p7-roadmap.md) — 階段切片
> - [`TODOS.md`](../TODOS.md) — 跨 sprint TODO 全表

---

## TL;DR

| 類別 | 數量 | 預估時間 |
|------|------|---------|
| **Ops 部署設定**（必做） | 6 項 | 1-2 天 |
| **未啟動 code（V2-P6/P7）** | 5 項 | 1-2 週 |
| **架構升級（V2-P7+）** | 3 項 | 1-2 sprint |
| **Security audit + docs** | 4 項 | 2-3 週 |

---

## A. Ops 部署設定（必做，sprint 末就要）

### A1. Resend email service 接通

**Why:** PR #296（email module）+ #302（wire into endpoints）已 merge，但 env 沒設 → email 完全沒寄。

```bash
# 1. resend.com signup → 拿 RESEND_API_KEY
# 2. 設 secret
wrangler pages secret put RESEND_API_KEY --project-name trip-planner
# 3. 設 EMAIL_FROM
echo 'Tripline <no-reply@trip-planner-dby.pages.dev>' | wrangler pages secret put EMAIL_FROM --project-name trip-planner
# 4. DNS TXT records (Resend dashboard 提供)
#    - SPF: include resend
#    - DKIM: 3 個 CNAME 給 resend
#    - DMARC: p=none → 觀察兩週後升 quarantine
```

**驗證：** signup → 收到驗證信 → click → /login?verified=1。

### A2. RSA signing keypair（id_token 簽章）

**Why:** PR #295（RS256 + JWKS dynamic）需 `OAUTH_SIGNING_PRIVATE_KEY`，沒設 → JWKS 回 `keys: []` + id_token 不簽。

```bash
# 產 RSA 2048 PKCS8 keypair
openssl genpkey -algorithm RSA -pkcs8 -out priv.pem -pkeyopt rsa_keygen_bits:2048
# 設 secret（PKCS8 PEM 直接餵）
wrangler pages secret put OAUTH_SIGNING_PRIVATE_KEY --project-name trip-planner < priv.pem
# 安全保管 priv.pem（不入 git，不 print 在 log）
mv priv.pem ~/.ssh/tripline-oauth-prod-key-2026-04.pem
chmod 400 ~/.ssh/tripline-oauth-prod-key-2026-04.pem
```

**驗證：** `curl https://your-domain/api/oauth/.well-known/jwks.json` → `keys` 含 1 個 RSA public key。

### A3. SESSION_SECRET 設 prod

**Why:** dev 在 `.dev.vars` 設了 (`qa-test-secret-...`)，prod env 沒設 → signup/login 全 500。

```bash
# 產 32+ char random secret
openssl rand -base64 48 | wrangler pages secret put SESSION_SECRET --project-name trip-planner
```

### A4. Google Cloud Console redirect_uri 更新（**等 PR #306 merge 後**）

**Why:** PR #306 把 callback 從 `/api/oauth/callback` → `/api/oauth/callback/google`。Google Console 不更新 → callback 拿 404。

1. https://console.cloud.google.com/apis/credentials
2. 編輯 OAuth 2.0 client
3. Authorized redirect URIs：
   - 移除 `https://trip-planner-dby.pages.dev/api/oauth/callback`
   - 新增 `https://trip-planner-dby.pages.dev/api/oauth/callback/google`
4. Save

### A5. Cloudflare Workers Cron Trigger（資料保留）

**Why:** V2-P6 audit log + session_devices 約 30 天保留設計，但沒人跑 cleanup → 表會無限長。

需建 `functions/api/cron/cleanup.ts`（新檔，ops PR）：

```typescript
// pseudo-code
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  // shared secret check
  if (ctx.request.headers.get('X-Cron-Secret') !== ctx.env.CRON_SECRET) return new Response(null, { status: 403 });
  await ctx.env.DB.prepare(`DELETE FROM auth_audit_log WHERE created_at < datetime('now', '-30 days')`).run();
  await ctx.env.DB.prepare(`DELETE FROM session_devices WHERE revoked_at IS NOT NULL OR (revoked_at IS NULL AND last_seen_at < datetime('now', '-30 days'))`).run();
  await ctx.env.DB.prepare(`DELETE FROM oauth_models WHERE expires_at IS NOT NULL AND expires_at < ?`).bind(Date.now()).run();
  await ctx.env.DB.prepare(`DELETE FROM rate_limit_buckets WHERE locked_until IS NULL AND window_start < ?`).bind(Date.now() - 24 * 60 * 60 * 1000).run();
  return new Response(JSON.stringify({ ok: true }));
};
```

CF Workers Cron Trigger 用獨立 Worker（Pages 不直接支援 cron），或外部 cron 打 endpoint：
- 建議外部：GitHub Actions schedule daily 打 `POST /api/cron/cleanup` with `X-Cron-Secret`
- 或換 Cloudflare Workers（不是 Pages Functions）跑 cron

### A6. Logpush → R2 cold storage

**Why:** V2 設計「audit log 30 天 D1 + Logpush 長期 R2」。30 天 cleanup 砍掉前要先 ship 到 R2 不然合規 / forensic 沒得查。

1. Cloudflare dashboard → Logpush → 建 R2 destination
2. Filter: `auth_audit_log` row write events（透過 D1 webhook 或 application-side log push）
3. R2 bucket lifecycle：1 年後 archive 到 deep storage

---

## B. 未啟動 code（V2-P6/P7 scope）

### B1. RSA Signing Key Rotation（90 天輪替）

**Why:** V2-P6 spec：「signing key 90 天 auto + 手動 emergency rotation」。當前 PR #295 只支援單一 env-set key，沒 rotation 機制。

**設計：**
- Migration: `oauth_signing_keys` table（schema 已在 v2-oauth-server-plan.md，未 ship）
- D1 row：`{ kid, alg, public_key, private_key_encrypted, status: 'active'|'retiring'|'retired', created_at, retire_after }`
- Rotate 流程：
  1. 產新 keypair 寫 D1（status='active'）
  2. 舊 key status → 'retiring'（grace period 1h+，cover existing access_token TTL）
  3. JWKS endpoint 同時 publish active + retiring keys
  4. Grace 過後 retiring → retired
- Encrypt private key at rest：env `OAUTH_KEY_ENCRYPT_SECRET` 用 AES-GCM

**Est:** 2-3 天 CC（schema + rotation script + JWKS multi-key + cron）

### B2. Multi-device sessions 強一致

**Why:** PR #305 用 hybrid HMAC + D1 best-effort revocation check。Read-after-write lag ~tens of ms，logout 後 in-flight request 偶爾撐過。Acceptable for V2-P6，但 V2-P7 需強一致。

**選項：**
- **Durable Object** per-user：單 instance 串行讀寫，無 race
- 缺點：每 request 過 DO（latency 增 ~10ms），且 DO 跨 Cloudflare PoP 有 affinity 問題

**Decision pending：** 待 V2-P7 評估 logout 速度需求。如果 user 反饋「我登出後對方還能用 30 秒」是 problem，優先做。

### B3. Salted IP hash for GDPR

**Why:** PR #305/#290 都用 unsalted `SHA-256(ip)`。Threat model：DB dump 可 IPv4 rainbow-table 反查。GDPR de-identification 需 keyed hash。

**Fix:**
- 加 env `SESSION_IP_HASH_SECRET`
- `hashIp` 改 `HMAC-SHA-256(secret, ip)` instead of `SHA-256(ip)`
- Migration 不需（hash format 不變，只是 secret 入 input）
- **舊 row 不 backfill**（新 hash 跟舊 hash 算法不同 — 接受 cutover 期間 IP-grouping 暫斷）

**Est:** 0.5 天 CC（小 PR）

### B4. HIBP password check

**Why:** V2 spec：「Password policy ≥10 chars + HIBP pwned-passwords API check」。當前只 check ≥8 chars，沒 HIBP。

**Fix:**
- signup + reset-password 加 HIBP API call
- 用 [pwnedpasswords.com k-anonymity API](https://haveibeenpwned.com/API/v3#PwnedPasswords)
- Hash前 5 char prefix 送 API → 拿回後綴 list → 本機比對
- 若中：reject `PASSWORD_PWNED` 引導重設

**Est:** 0.5 天 CC

### B5. Email change + verify flow

**Why:** V2 spec 提了 `users.pending_email` 但沒 schema。User 改 email → 需要驗新 email 才生效。

**Fix:**
- Migration：`users` 加 `pending_email` + `pending_email_verify_token_hash`
- Endpoint：`POST /api/account/email-change` 寫 pending + 寄驗證信
- Endpoint：`GET /api/oauth/verify-email-change?token=...` 驗 → swap pending → primary
- Frontend：settings 頁加 email 改

**Est:** 1 天 CC

---

## C. 架構升級（V2-P7+）

### C1. Audit log integrity（chain hash）

**Why:** 目前 audit log 是 plain INSERT，admin 可竄改。Forensic 等級需 immutable 證明。

**Fix:** 每 row 加 `prev_row_hash`：當前 row content + prev row hash 一起 SHA-256，鎖鏈。任何中間 row 改 → 後續 hash 全錯。

**Est:** 1 天 CC + 1 天 think（threat model）

### C2. Anomaly detection email alert

**Why:** V2-P6 spec：「new IP / new country → email user」。

**Fix:**
- session_devices 寫入時 cross-check 同 user 的 ip_hash 歷史
- 不同 ip_hash_prefix（粗粒度 country level） → trigger anomaly email
- 用 `auth_audit_log` 加 event_type='anomaly_alert' 紀錄

**Est:** 1 天 CC（含 GeoIP 加 city/country enrichment 簡單版）

### C3. Developer dashboard refresh

**Why:** PR #291/#294 backend + #300 UI 已 ship，但缺：
- Live API logs（per client_id 7 天回測）
- Token usage stats（DAU per app）
- Webhook config（user.created, trip.shared — V2-P7 deferred 但 schema 該先）

**Est:** 3-5 天 CC（含 monitoring backend）

---

## D. Security audit + 上線 gate

### D1. Independent security audit（強制 gate）

**Why:** V2 spec autoplan：「prod 上線前必做獨立第三方 audit」。

**Options:**
- Trail of Bits (~$30k/週) — 高品質，可信度高
- Cure53 (~$20k/週) — 歐洲，GDPR 友善
- HackerOne bug bounty (5k+/bug) — 無上限可能省錢但 pace 不可控

**Decision pending:** 預算 + 時程。建議 V2 prod launch 前 4 週開 ticket。

### D2. OIDC conformance test

**Why:** [openid.net/certification](https://openid.net/certification) 自動化測 OIDC 規範。免費。

**Steps:**
1. https://www.certification.openid.net/login.html
2. 跑 OP Basic Profile + RP-Initiated Logout test plan
3. 修任何 fail → certified badge

**Est:** 1-2 天（含修一兩個 minor compliance issue）

### D3. Rate limit event audit log

**Why:** PR #303 wire audit 進 6 endpoint，但 rate_limited (429) 路徑沒紀錄。Forensic 缺 brute force 嘗試證據。

**Fix:** rate_limit 觸發時 fire `recordAuthEvent({ eventType: 'rate_limited', metadata: { endpoint, bucket_key } })`。

**Est:** 30 min（小 patch）

### D4. CSP + security headers full audit

**Why:** 當前 `_middleware.ts` 有 CSP 但沒掃過 V2 OAuth Server 新 endpoint 是否破 CSP。

**Fix:** 跑 [securityheaders.com](https://securityheaders.com) + 手動 review V2 endpoints 的 inline script / form-action / connect-src。

**Est:** 0.5 天

---

## E. External developer docs（V2-P7）

### E1. Quickstart guide（5 min）

`docs/oauth/quickstart.md`：
1. 申請 client_id（dev dashboard screenshot）
2. 第一次 OAuth flow（curl 範例）
3. 拿 access_token → 打 userinfo
4. 常見錯誤 troubleshooting

### E2. API reference

`docs/oauth/api-reference.md`：
- Discovery doc fields 一覽
- 各 endpoint params + responses
- Error code catalog（13 個 RFC 6749 standard）
- Rate limit headers + 429 policy

### E3. SDK / integration examples

`docs/oauth/integrations/`：
- `nextjs-app-router.md`
- `express-passport.md`
- `python-requests-oauthlib.md`
- `curl-shell-script.md`

每篇 working sample，user 跑得起來。

### E4. Sandbox env

獨立 `auth-staging.trip-planner-dby.pages.dev` issuer + seeded test users + 短期 test client_apps，給開發者測流程。

---

## F. PR coordination 提示（transient — merge 完就過時）

**目前 in-flight PRs（截至 2026-04-25）：**

| PR | Title | Status |
|----|-------|--------|
| #288 | wire rate limit → /login | CI ✓ |
| #289 | wire rate limit → /signup /forgot /token | CI ✓ |
| #290 | auth_audit_log foundation | CI ✓ |
| #291 | /api/dev/apps register + list | CI ✓ |
| #292 | /api/oauth/verify + send-verification | CI ✓ |
| #293 | /api/account/connected-apps | CI ✓ |
| #294 | /api/dev/apps/:id detail/patch/delete | CI ✓ |
| #295 | RS256 JWT id_token + JWKS | CI ✓ |
| #296 | email module + templates | CI ✓ |
| #297 | SignupPage + EmailVerifyPending | CI ✓ |
| #298 | ForgotPasswordPage + ResetPasswordPage | CI ✓ |
| #299 | ConnectedAppsPage UI | CI ✓ |
| #300 | DeveloperAppsPage UI | CI ✓ |
| #301 | sidebar nav links | CI 跑中 |
| #302 | wire email into endpoints | CI ✓ |
| #303 | wire audit into endpoints | CI ✓ |
| #304 | LoginPage form + lockout | CI ✓ |
| #305 | multi-device sessions full stack | CI ✓ |
| #306 | OIDC public path routing fix | CI 跑中 |

**Merge order 建議：**

1. **先**：#306（OIDC routing rename）— file 重 namespace 影響其他 PR rebase
2. **後**：剩下依 dependency 順序：
   - Foundation 系 (#290, #295, #296) → 第二批
   - Wire 系 (#288, #289, #302, #303) → 第三批，rebase 對齊 #306 的新檔名
   - UI + frontend → 最後（沒檔名衝突）

**對 #306 衝突的 PR**（檔名 rename `server-*` → 公共名）：
- #295（修 server-token.ts）
- #289（修 server-token.ts + signup.ts）
- #303（修 server-token.ts + server-authorize.ts + server-consent.ts）
- #305（測試引用 _session.ts，間接安全）

→ 這些 PR 在 #306 land 後重新 rebase，讓 git rename detection 把 diff 對到新檔名。

---

## 附：關鍵 CHEATSHEET

```bash
# 跑全 V2 test (V2 OAuth)
npm run test -- --reporter=verbose tests/api/oauth-*

# Verify deploy 後 OIDC discovery 完整
curl https://trip-planner-dby.pages.dev/api/oauth/.well-known/openid-configuration | jq .

# 確認 JWKS 有 active key
curl https://trip-planner-dby.pages.dev/api/oauth/.well-known/jwks.json | jq '.keys | length'

# 手測 OAuth Server flow
# 1. 建 client_app（透過 /api/dev/apps）
# 2. /authorize 拿 code
# 3. /token 換 access_token + id_token
# 4. /userinfo 驗 sub
```
