# V2-P1 OAuth — Google Cloud Console + Cloudflare secrets setup

**Audience:** Ops / Ray
**When:** V2-P1 ship 後，第一次啟用 Google login 前
**Time:** ~15 分鐘

---

## TL;DR

1. Google Cloud Console 建 OAuth 2.0 Client（Web application type）
2. Authorized redirect URI 加 `https://trip-planner-dby.pages.dev/api/oauth/callback`
3. 從 Google 拿 Client ID + Client Secret
4. `wrangler secret put` 三個 secrets 進 Cloudflare（CLIENT_ID + CLIENT_SECRET + SESSION_SECRET）
5. Smoke test：本機 `npm run dev` + 開 https://localhost:8788/login → 「使用 Google 登入」

---

## Step 1 — Google Cloud Console

1. 進 https://console.cloud.google.com/
2. 選一個 project（或建新的「tripline-prod」）
3. **APIs & Services** → **OAuth consent screen**：
   - User Type: **External**
   - App name: `Tripline`
   - User support email: lean.lean@gmail.com
   - Developer contact: lean.lean@gmail.com
   - Authorized domains: `trip-planner-dby.pages.dev`（後續加 custom domain）
   - Scopes：加 `openid`, `profile`, `email`
   - Test users：lean.lean@gmail.com + 其他 alpha tester
4. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**：
   - Application type: **Web application**
   - Name: `tripline-pages-prod`
   - **Authorized JavaScript origins**：
     - `https://trip-planner-dby.pages.dev`
     - `http://localhost:8788`（本機 dev）
   - **Authorized redirect URIs**：
     - `https://trip-planner-dby.pages.dev/api/oauth/callback`
     - `http://localhost:8788/api/oauth/callback`（本機 dev）
5. 拿到 Client ID + Client Secret，**Client Secret 只顯示一次，立刻複製**

---

## Step 2 — Cloudflare secrets

```bash
# Production environment
wrangler secret put GOOGLE_CLIENT_ID --env production
# 貼 step 1 的 client id

wrangler secret put GOOGLE_CLIENT_SECRET --env production
# 貼 step 1 的 client secret

# SESSION_SECRET — 32+ char random，用 openssl 生
openssl rand -base64 48
# copy output, 然後：
wrangler secret put SESSION_SECRET --env production
```

> ⚠️ **SESSION_SECRET 一旦設定不要換**：所有現有 session cookie 立即失效，所有
> user 被踢出。要 rotate 必須有 grace period（V2-P6 加 dual-secret support）。

## Step 3 — Local dev

`.dev.vars` 加：

```
GOOGLE_CLIENT_ID=<step-1-id>
GOOGLE_CLIENT_SECRET=<step-1-secret>
SESSION_SECRET=<openssl rand -base64 48 output>
```

`.dev.vars` 不入版控（已 .gitignore）。

---

## Step 4 — Smoke test

```bash
npm run dev
```

開 http://localhost:8788/login → 點「使用 Google 登入」 →

1. 跳到 Google consent screen → 選 lean.lean@gmail.com → 同意
2. 跳回 http://localhost:8788/manage（state.redirectAfterLogin default）
3. 開 DevTools → Application → Cookies → 看 `tripline_session` 30 day 有效
4. 看 D1 `users` table 有新 row + `auth_identities` 有 (google, sub) row

如果失敗：
- 看 wrangler dev terminal log
- 確認 `.dev.vars` 三個 secrets 都設
- 確認 redirect URI 完全 match (含 trailing slash 不能差)
- D1 是否跑過 migration 0031 + 0032（`npm run dev:reset` rebuild）

---

## Step 5 — Production verify

Cloudflare Pages auto-deploy on master merge。設 secrets 後：

```bash
# Verify discovery doc 仍 work
curl https://trip-planner-dby.pages.dev/api/oauth/.well-known/openid-configuration | jq .

# Verify authorize redirect (不點 follow)
curl -I https://trip-planner-dby.pages.dev/api/oauth/authorize?provider=google
# Expected: 302 + Location header to accounts.google.com

# Browser flow（人手測）
# https://trip-planner-dby.pages.dev/login → 點 button → 流程同 step 4
```

---

## Step 6 — Backfill existing users（first prod login 後）

V2-P1 ship 前既有 trips 用 email 識別 owner（saved_pois.email / trip_permissions.email / trip_ideas.added_by）。第一個 user Google 登入建 user row 後：

1. 查 user 的 email 是否在既有 email columns 出現
2. Backfill script：把 email 換成 user_id（or 加 user_id column FK to users）
3. 計畫 V2-P2 ship 完整 backfill migration

當前 V2-P1：新 user 透過 Google 登入但 trips 仍 owned by email。Hybrid period OK 因為兩個 ID 系統共存（email 是 anchor）。V2-P2 backfill。

---

## 相關

- `docs/v2-oauth-server-plan.md` — V2 整體架構
- `docs/v2-oauth-spike-result.md` — Day 0 spike 結果
- `functions/api/oauth/authorize.ts` / `callback.ts` — endpoint 實作
- `migrations/0031_oauth_models.sql` / `0032_users_auth_identities.sql` — schema
- `src/server/session.ts` / `functions/api/_cookies.ts` / `_session.ts` — session stack
