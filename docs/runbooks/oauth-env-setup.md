# Runbook — V2 OAuth env setup

**Last updated**: 2026-05-24 (v2.33.69)
**Scope**: V2 OAuth-related env vars (SESSION_SECRET / SESSION_IP_HASH_SECRET /
PUBLIC_ORIGIN / ENVIRONMENT 等)

## V2 OAuth env list

| Env | Required | Source | Rotation |
|-----|----------|--------|----------|
| `SESSION_SECRET` | YES | wrangler secret | 半年 (forces all logout) |
| `SESSION_IP_HASH_SECRET` | RECOMMENDED | wrangler secret | 年 (新 audit row HMAC, 舊 SHA-256 30d 後消失) |
| `PUBLIC_ORIGIN` | RECOMMENDED | wrangler.toml `[env.X.vars]` | infrequent (URL 不變) |
| `ENVIRONMENT` | YES | wrangler.toml `[env.X.vars]` | static |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | YES (Google login) | wrangler secret | Google Console rotation |
| `OAUTH_SIGNING_PRIVATE_KEY` | YES (issue id_token) | wrangler secret | 半年 (invalidates outstanding id_tokens) |
| `RESEND_API_KEY` 或 mail tunnel | YES (email send) | wrangler secret | per provider policy |

## Initial deploy setup

```bash
# 1. Session signing secret (HMAC, base64url 32 byte)
openssl rand -base64 32 | tr '/+' '_-' | tr -d '=' | \
  wrangler pages secret put SESSION_SECRET --project-name trip-planner

# 2. IP hash secret (HMAC of CF-Connecting-IP, defense vs DB-dump rainbow)
openssl rand -base64 32 | tr '/+' '_-' | tr -d '=' | \
  wrangler pages secret put SESSION_IP_HASH_SECRET --project-name trip-planner

# 3. OIDC id_token signing key (RS256 PKCS8 PEM)
openssl genrsa 2048 | \
  wrangler pages secret put OAUTH_SIGNING_PRIVATE_KEY --project-name trip-planner

# 4. ENVIRONMENT — 已在 wrangler.toml [env.production.vars]，無需 wrangler set
#    驗證: CF dashboard → Pages → Settings → Environment variables
```

`wrangler.toml` 對 ENVIRONMENT 的 declaration (v2.33.60 round 14):

```toml
[env.production.vars]
ENVIRONMENT = "production"

[env.preview]
[env.preview.vars]
ENVIRONMENT = "preview"
```

`PUBLIC_ORIGIN` 加在 `[env.production.vars]` (v2.33.59 round 13):

```toml
[env.production.vars]
ENVIRONMENT = "production"
PUBLIC_ORIGIN = "https://trip-planner-dby.pages.dev"
```

## Rotation procedure

### SESSION_SECRET rotation (半年)

**Impact**: All existing sessions invalidated → all users logged out。Schedule
during low-traffic window (e.g. 凌晨 2-4 AM 台灣)。

```bash
# Generate new secret
NEW_SECRET=$(openssl rand -base64 32 | tr '/+' '_-' | tr -d '=')
echo "$NEW_SECRET" | wrangler pages secret put SESSION_SECRET --project-name trip-planner

# Wait for CF Pages env propagation (~30s)
# Verify: log in via incognito，should succeed with new secret signing
```

### SESSION_IP_HASH_SECRET rotation (年)

**Impact**: 新 audit row 用新 secret HMAC，舊 row 用舊 secret HMAC — 兩者
不互查 (查 IP X 命中 secret A row 但 secret B row miss)。30 天 retention
後舊 row sweep 自然清理。

```bash
NEW_SECRET=$(openssl rand -base64 32 | tr '/+' '_-' | tr -d '=')
echo "$NEW_SECRET" | wrangler pages secret put SESSION_IP_HASH_SECRET --project-name trip-planner
```

無 user-visible impact。Forensic IP correlation 跨 rotation 點需要查 audit log
ts > rotation 時刻才命中新 hash。

### OAUTH_SIGNING_PRIVATE_KEY rotation

**Impact**: 所有 outstanding id_token 失效 (但 access_token / refresh_token
仍有效，因為它們 opaque tokens 不用 JWT verify)。OIDC `.well-known/jwks.json`
endpoint 會 expose new public key。relying parties (其他 OAuth client) 看到
key rotation 需 re-fetch JWKS。

```bash
# Generate new RSA 2048 keypair
openssl genrsa 2048 | wrangler pages secret put OAUTH_SIGNING_PRIVATE_KEY --project-name trip-planner

# Optional: warm JWKS cache by hitting .well-known endpoint
curl https://trip-planner-dby.pages.dev/api/oauth/.well-known/jwks.json
```

## DEV_MOCK_EMAIL safety

`_middleware.ts:241-247` 守衛：

```ts
if (env.DEV_MOCK_EMAIL && (envBag.ENVIRONMENT === 'production' || envBag.NODE_ENV === 'production')) {
  // refuse — fail-closed, prevent prod auth bypass
}
```

`wrangler.toml` 強制聲明 `ENVIRONMENT = "production"` (v2.33.60 round 14)，所以
即使 CF dashboard 不小心設了 `DEV_MOCK_EMAIL` 也不會繞過 prod auth。

**Dev**: 在 `.dev.vars` (NOT `.env.local`):
```bash
DEV_MOCK_EMAIL=you@example.com
```

## Sentry CSP report endpoint (v2.33.62)

`public/_headers` `Report-To` header 包 PLACEHOLDER:

```
Report-To: {"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"https://o.ingest.us.sentry.io/api/0/security/?sentry_key=PLACEHOLDER"}],"include_subdomains":true}
```

部署前修：
1. Sentry dashboard → Project Settings → Security Headers
2. 取「CSP Endpoint」complete URL (含 sentry_key query)
3. 替換 `public/_headers` PLACEHOLDER 整段 URL

之後 CSP violation 自動 POST 到 Sentry，可在 Sentry issue list 看到。

## Verification post-deploy

```bash
# 1. Session cookie HMAC sig 正確 (login + 看 cookie)
curl -i https://trip-planner-dby.pages.dev/api/oauth/login \
  -X POST -H 'content-type: application/json' \
  -d '{"email":"test@example.com","password":"..."}'

# 2. JWKS endpoint serves current key
curl https://trip-planner-dby.pages.dev/api/oauth/.well-known/jwks.json | jq

# 3. OIDC discovery
curl https://trip-planner-dby.pages.dev/api/oauth/.well-known/openid-configuration | jq

# 4. ENVIRONMENT prod check (DEV_MOCK_EMAIL guard active)
curl https://trip-planner-dby.pages.dev/api/oauth/userinfo \
  -H "Authorization: Bearer <bad-token>"
# Expect 401 (not bypass via DEV_MOCK_EMAIL)
```

## Common issues

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| All users logged out after deploy | SESSION_SECRET 變了 | Confirm secret rotation (intended) or revert |
| `oauth_models payload too large` error | Caller writing > 16KB payload | Audit caller, payload should be small (v2.33.63 cap) |
| Auth audit log empty after deploy | SESSION_IP_HASH_SECRET wrong / missing | Re-set secret, verify with `wrangler secret list` |
| Email link redirects to localhost | PUBLIC_ORIGIN missing | Set in wrangler.toml [env.production.vars] + redeploy |
| CSP report-to silent (no Sentry events) | PLACEHOLDER URL still in `_headers` | Replace with real Sentry CSP endpoint |

## Reference

- ARCHITECTURE.md — Auth section (V2 OAuth design)
- src/server/session.ts — HKDF derive + dual-path verify
- src/server/jwt.ts — alg pin + clock skew
- functions/api/_middleware.ts — Origin check + DEV_MOCK_EMAIL guard
- functions/api/_auth_audit.ts — HMAC IP hash
