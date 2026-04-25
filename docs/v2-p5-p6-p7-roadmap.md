# V2-P5 / V2-P6 / V2-P7 Roadmap

**Status:** Starter doc shipped 2026-04-25。Implementation starts after V2-P4 OAuth Server core endpoints land。

**Audience:** dev / ops / Ray when scheduling V2-P5+ sprint work。

---

## TL;DR

V2-P1 ~ V2-P4 已 ship sprint 1 starters（schema + endpoints + UI + 14 PR + V2-P2 hash/signup/login + V2-P3 forgot/reset + V2-P4 client_apps schema）。剩 V2-P5 ~ V2-P7（6 週 work）需要 V2-P4 OAuth Server endpoints land 後才能銜接。

---

## V2-P5 Token + Consent screen（Week 9-10）

### Scope

OAuth Server token issuance + UI consent flow + token lifecycle management。

### Slices

1. **Consent screen UI** — `/oauth/consent?client_id=...&scope=...`
   - React page show 「{client.app_name} 想存取您的 {scope list}」
   - 同意 / 拒絕 button → POST 回 D1 oauth_models name='Consent'
   - First-time only：之後同 client+scope 自動 skip consent（unless `prompt=consent`）

2. **Token issuance refinement** — `/api/oauth/token`
   - authorization_code grant → access_token + refresh_token + id_token (RS256 sign)
   - refresh_token grant → new access_token (rotate refresh_token)
   - 用 `oidc-provider` library OR hand-roll (Koa↔Fetch bridge needed for library)

3. **Token revocation** — `/api/oauth/revoke` (RFC 7009)
   - POST `{ token, token_type_hint }`
   - Validate client_id (Basic auth or body) + lookup token in D1
   - destroy token + cascade revoke grant_id-related tokens
   - 200 regardless of token validity (per RFC 7009 spec)

4. **Scope management** — `src/server/scopes.ts`
   - Static scope registry: `openid`, `profile`, `email`, `offline_access`, `trips:read`, `trips:write`
   - `validateScopes(requested, allowed)` helper
   - Consent screen render scopes 的 human-readable description

### Deliverables

- src/pages/ConsentPage.tsx + tests
- functions/api/oauth/token.ts + tests (currently spike-only)
- functions/api/oauth/revoke.ts + tests
- src/server/scopes.ts + tests

---

## V2-P6 Security hardening（Week 11-12）

### Scope

Production-grade security gates 補完。

### Slices

1. **Rate limit middleware**
   - `_rate_limit.ts` middleware：per-IP + per-client
   - D1 `rate_limit_buckets` table OR Cloudflare Rate Limiting (preferred — edge level)
   - Apply to: `/login`, `/signup`, `/forgot-password`, `/oauth/token`, `/oauth/authorize`
   - Lockout after N failed attempts in window
   - Audit log on lockout trigger

2. **PKCE enforcement**
   - `client_apps.client_type = 'public'` → PKCE required
   - `/oauth/authorize` reject 缺 `code_challenge`
   - `/oauth/token` verify `code_verifier`

3. **Redirect URI strict matching**
   - Already 在 V2-P4 client_apps.redirect_uris JSON array
   - `/oauth/authorize` exact match (no wildcard, no trailing slash tolerance)
   - Reject non-https redirect_uri (除非 localhost dev)

4. **Audit log expansion**
   - Migration `0035_audit_log_user_id`：加 `user_id` FK + `client_id` FK columns
   - 既有 `audit_log.changed_by` (email) → backfill 後 retire
   - Log events: signup / login / logout / consent_granted / consent_revoked / token_issued / token_revoked / password_reset / password_changed / client_app_created / client_app_suspended

5. **Session opaque cookie + SHA-256 hash 已 done** (V2-P1)
   - 現有 src/server/session.ts 已是 opaque HMAC，符合 V2-P6 spec

6. **Key rotation infrastructure**
   - `oauth_models` name='SigningKey' — store RS256 keypairs
   - JWKS endpoint dynamic from D1
   - Cron rotate keys + grace period（既有 token verify 仍能用 old key X 天）

### Deliverables

- functions/api/_rate_limit.ts + tests
- migrations/0035_audit_log_user_id.sql + tests
- migrations/0036_signing_keys.sql + tests
- functions/api/oauth/authorize.ts PKCE 强制
- scripts/rotate-signing-keys.js (cron 用)

---

## V2-P7 Docs + Audit + Launch（Week 13-14）

### Scope

Public 啟用準備：external developer docs + security audit booking + post-launch monitoring。

### Slices

1. **OAuth developer docs**
   - `docs/oauth/getting-started.md` — client integration guide
   - `docs/oauth/scopes.md` — scope reference
   - `docs/oauth/authorize-flow.md` — authorization_code flow walkthrough
   - `docs/oauth/refresh-flow.md` — refresh_token rotation
   - `docs/oauth/revocation.md` — RFC 7009 endpoint
   - Tripline developer dashboard scaffold（register client app UI）

2. **External security audit booking**
   - **Trail of Bits** OR **Cure53** — 4-8 週 lead time
   - Scope: V2-P1 ~ V2-P6 全部 ship 後 audit
   - Budget: $30k-$80k typical for OAuth/identity audit
   - 必須 V2-P1 sprint 開始就 book（避免 launch delay）

3. **Pre-launch checklist**
   - [ ] 全 V2-P1 ~ V2-P6 endpoints + tests pass
   - [ ] PKCE enforcement on all public clients
   - [ ] Redirect URI strict matching verified
   - [ ] Audit log all events recorded
   - [ ] Rate limit threshold tuned (30 days dry-run)
   - [ ] Sentry release tagged + alerts configured (V2-P6 hardening 整合)
   - [ ] Lighthouse a11y ≥ 90 on consent screen
   - [ ] External audit findings remediated
   - [ ] Disaster recovery runbook（D1 backup + restore drill）
   - [ ] Public status page (statuspage.io / Cloudflare native)

4. **Public launch announcement**
   - Blog post / dev mailing list
   - Migration guide for existing email-based users → V2 OAuth
   - Deprecation timeline for Cloudflare Access fallback

### Deliverables

- docs/oauth/ folder (5 files)
- Developer dashboard UI (Register Client / View Credentials)
- docs/v2-launch-checklist.md (signed off pre-launch)
- BLOG.md or dev mailing list draft

---

## Phase tracker（current state）

| Phase | Slices done | Total est | Status |
|-------|-------------|-----------|--------|
| V2-P1 OAuth Identity Core | 17 + backfill prep | sprint 1 | ✓ done |
| V2-P2 Local password | 3 (hash/signup/login) | ~6 | 🔄 in progress |
| V2-P3 忘記密碼 | 2 (forgot/reset) | ~4 | 🔄 in progress |
| V2-P4 OAuth Server | 1 (client_apps schema) | ~6 | 🔄 in progress |
| V2-P5 Token + Consent | 0 | ~5 | ⏳ pending V2-P4 |
| V2-P6 Security hardening | 0 | ~6 | ⏳ pending V2-P4/P5 |
| V2-P7 Docs + Audit + Launch | 0 (本 doc starter) | ~5 | ⏳ pending V2-P6 |

---

## Critical path

```
V2-P1 ✓
  ↓
V2-P2 → V2-P3 (parallel-ish, share password module)
  ↓
V2-P4 OAuth Server core endpoints (auth/token using oidc-provider lib + Koa↔Fetch bridge)
  ↓
V2-P5 (depends on V2-P4 token endpoint shape)
  ↓
V2-P6 hardening (PKCE 在 V2-P4 才 enforce) + audit log
  ↓
V2-P7 docs / audit / launch
```

---

## Memory anchor

- `docs/v2-oauth-server-plan.md` — 整體 14 週 plan
- `docs/v2-oauth-spike-result.md` — Day 0 spike (oidc-provider works in CF Workers)
- `docs/v2-oauth-google-setup.md` — V2-P1 Google OAuth ops setup
- `docs/2026-04-24-saas-pivot-roadmap.md` — SaaS pivot 整體
- 本 doc — V2-P5/P6/P7 detail roadmap

下個 session 起手：完成 V2-P2/P3/P4 剩餘 slices → 接到 V2-P5。
