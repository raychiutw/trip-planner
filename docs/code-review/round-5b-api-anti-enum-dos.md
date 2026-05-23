# Round 5b — functions/api/ Anti-Enumeration + DoS Protection

- **PR**: [#721](https://github.com/raychiutw/trip-planner/pull/721)
- **Version**: v2.33.42
- **Date**: 2026-05-23

## Findings

### HIGH (privilege escalation)

| # | Location | Issue | Status |
|---|----------|-------|--------|
| H1 | `dev/apps.ts:71-78` `validateScopes` | 接受 caller body 任意 scope。Status 初始 `pending_review`，但 ops 一旦 flip 為 active 沒 scrub scope → attacker 拿 `client_credentials` 即得 admin-token (透過 middleware `isAdmin = scopes.includes('admin')`) | ✅ Fixed: `ALLOWED_USER_SCOPES` allowlist (openid/profile/email/offline_access)；拒 admin/companion |
| H2 | `requests/[id]/events.ts:122` SSE | `Access-Control-Allow-Origin: *` header — 跨 origin EventSource 可訂閱（雖無 cookie 但仍 attack surface 鬆） | ✅ Fixed: 拔 header (same-origin SPA 不需要) |

### MEDIUM (user-enumeration oracle)

| # | Location | Issue | Status |
|---|----------|-------|--------|
| M1 | `permissions.ts:232/295` POST | response shape `'permission_added'` (已註冊) vs `'invitation_sent'` (未註冊) → 任何 logged-in user 探任意 email 是否註冊 | ✅ Fixed: 統一 `'invitation_sent'` |
| M2 | `oauth/login.ts:78` | email-bucket `LOGIN_RATE_LIMITED` 「此 email 登入嘗試過多」vs IP-bucket 通用 message — 燒 5 attempt 可確認 email | ✅ Fixed: 統一 message |
| M3 | `oauth/forgot-password.ts:73` | 同樣 email-bucket 「此 email 重設請求過多」leak account existence | ✅ Fixed: 統一 message |

### MEDIUM (paid quota DoS)

| # | Endpoint | Cost | Fix |
|---|----------|------|-----|
| M4 | `/api/route` | Google Routes ~$5/1000 | ✅ 100/24h per IP via `RATE_LIMITS.ROUTE_PER_IP` |
| M5 | `/api/poi-search` | Google Places Text Search ~$32/1000 | ✅ 200/24h per IP via `POI_SEARCH_PER_IP` |
| M6 | `/api/reports` | D1 write spam (anonymous endpoint) | ✅ 200/24h per IP via `REPORTS_PER_IP` |

### MEDIUM (reports hardening)

| # | Location | Issue | Status |
|---|----------|-------|--------|
| M7 | `reports.ts:34-43` | 接受任意字串 + 無 length cap + 無 tripId existence check → D1 spam | ✅ Fixed: clamp 2000 char + strip newline + verify tripId IN trips |

### MEDIUM (pagination bug)

| # | Location | Issue | Status |
|---|----------|-------|--------|
| M8 | `requests.ts:72-79` | `after`/`afterId` cursor 用 `<` 比較（與 `before` 同向）→ sort=asc 拿到錯方向 page | ✅ Fixed: 改 `>` |

### Tests (+7)

- `round5b-security.integration.test.ts`：
  - permissions shape unified
  - dev/apps validateScopes 拒 admin
  - reports nonexistent tripId → 404
  - reports field > 2000 char clamp
  - SSE 不再帶 `Access-Control-Allow-Origin: *`
  - requests after `>` comparator

### Deferred to round 5c

- `_middleware.ts` Bearer skip CSRF
- `oauth/authorize.ts` `prompt=consent` 不 invalidate
- 3 個 non-atomic write (entries POST / copy / trip-pois)
- `entries/[eid].ts` SQL error swallow
