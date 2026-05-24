# Round 12 — src/server/ security + test catch-up (v2.33.58)

**日期**: 2026-05-24
**PR**: TBD (refactor/v2.33.58-server-security → master)
**Module**: `src/server/` (12 檔 1851 LOC) + 1 callsite (`functions/api/oauth/token.ts`)
**LOC**: ~150 行 fix + ~400 行新 test

## 背景

backlog #131 — 3 個 parallel agent (code-reviewer / security-auditor /
test-engineer) review `src/server/` 找出 OAuth / JWT / password / email
/ Google Maps client 多個 security issue + 3 個 CRITICAL zero-coverage file。

## 修了什麼 (12a + 12b 一個 PR 內)

### CRITICAL — Security

| Code | File | Issue → Fix |
|------|------|-------------|
| C1 | `src/server/jwt.ts` | `verifyJwt` 不檢查 `header.alg` → algorithm-confusion 隱患（未來 multi-algo 一引入即 CVE）。**Fix**: header.alg allowlist (default `['RS256']`)，拒 `none` / `HS256` / 任何非 allowed。新增 `expectedAlg?: string[]` option。 |
| C2/H4 | `src/server/oauth-client/google-id-token.ts` | `verifyGoogleIdToken` 不 enforce `email_verified === true` → 攻擊者未驗證 email 的 Google 帳號可 squat 既有 email。**Fix**: verifier 內直接拒；同時加 OIDC §3.1.3.7 step 8 `azp` 檢查。 |
| C3 | `src/server/email-templates.ts` | `tripTitle` / `inviterLabel` 含 `\r\n` 直接打進 Subject → SMTP header injection (Bcc 注入)。**Fix**: `sanitizeHeaderField()` strip `\r\n\0`。HTML body 仍走 `escapeHtml` 不受影響。 |
| C4 | `src/server/oauth-d1-adapter.ts` + `functions/api/oauth/token.ts` | `consume()` unconditional UPDATE → 平行 POST /token 兩個都通過 `.consumed` 早期檢查、都 issueTokenPair、都 consume，產生 2 個獨立 grantId。**Fix**: `consume()` 改 conditional UPDATE `WHERE consumed IS NULL` 返 boolean。token.ts 兩處 caller (auth_code exchange / refresh rotation) 改先 consume 再 issue；race 輸者 abort + 對 refresh family 觸發 cascade revoke。 |

### HIGH

| Code | File | Issue → Fix |
|------|------|-------------|
| H1 | `src/server/oauth-server/validate-redirect-uris.ts` | 不拒 `#fragment` / `userinfo@` / `?query` → 下游 exact-match 字串相等可被 parser confusion / browser quirk 利用做 open-redirect / code leak。**Fix**: 全拒。 |
| H3 | `src/server/password.ts` | PBKDF2 iter `100_000` 低於 OWASP 2023 `600_000`。Comment 騙說「OWASP 最低」但實際是過時 2017 guideline。**Fix**: 升 600k (user 2026-05-24 確認)。Self-describing format 舊 hash 仍 verify，next login `needsRehash()` 觸發漸進升級。 |
| H5 | `src/server/session.ts` | Comment 誇大「CSRF token POST/PUT/DELETE 都驗」但無 endpoint 真讀 `payload.csrf`。Defense 實際靠 `_middleware.ts` Origin allowlist + Cookie SameSite=Lax。**Fix**: 註解明寫「csrf field 保留為 future-proof，未 wire double-submit，勿假設防護啟用」。 |

### MEDIUM

| Code | File | Issue → Fix |
|------|------|-------------|
| I1 | `src/server/password.ts` | `hashPassword()` 寫死 `< 8`，跟 `MIN_PASSWORD_LEN` 漂移 → 未來改 `MIN_PASSWORD_LEN = 12` 仍接受 8 字元密碼。**Fix**: 用常數。 |
| I2 | `src/server/jwt.ts` | exp 加 60s clockSkew → 已過期 token 多 60s 可用。**Fix**: exp 嚴格 `nowSec >= claims.exp` 拒，nbf 保留 skew (issuer clock-ahead tolerance)。 |
| I5 | `src/server/maps/google-client.ts` | 缺 `apiKey` 預檢，空字串送 Google 後拿 401 → ops 看不出設定問題 vs 上游壞。**Fix**: `requireApiKey()` 預檢拋 `MAPS_CONFIG` (新 error code)。 |
| — | `src/server/oauth-d1-adapter.ts` | `revokeByGrantId` 不限 model name → 未來新 model 含 `grantId` field 會被無辜誤刪。**Fix**: `WHERE name IN ('AccessToken','RefreshToken')`。 |

## 新增 test (CRITICAL ZERO_COVERAGE fill)

| File | Cases | 覆蓋 |
|------|-------|------|
| `tests/unit/google-id-token.test.ts` | 10 | 之前整個 module 在 oauth-callback-google.test.ts 被 vi.mock 掉。本檔 happy path / kid missing / kid not in JWKS / email_verified false/missing / azp mismatch / azp match / iss whitelist 兩種 form / aud mismatch |
| `tests/unit/invitation-token.test.ts` | 11 | generate uniqueness 50× / HMAC parity / secret rotation / token differ / base64url shape / TTL helper default + custom + const |
| `tests/unit/invitation-accept.test.ts` | 9 | 4 個 fail code + email case-insensitive + happy path + missing trip title graceful + batch 2 stmt + HMAC parity |
| `tests/unit/validate-redirect-uris.test.ts` | 17 | happy 4 scheme + 5 bypass (javascript/data/file/ftp/http remote) + 3 component bypass (frag/userinfo/query) + boundary 5 |
| `tests/unit/jwt-alg-pin.test.ts` | 8 | RS256 happy / alg=none/HS256/ES256 reject / typ check / expectedAlg override / exp strict / nbf skew preserved |
| `tests/unit/round-12-server-security.test.ts` | 20 | source-grep guard for all 12a fix |

**Total +75 test**, 全 suite 2403 → 2478。

## Test 更新

- `tests/unit/oauth-d1-adapter.test.ts` revokeByGrantId 對齊新 SQL shape (name IN ...)

## 沒做 (defer)

| Code | Why deferred |
|------|--------------|
| H2 | verify endpoint GET → POST + Referrer-Policy 需 email link landing-page 改造 (UX flow) |
| M (HMAC domain separation) | HKDF sub-key 改 secret schema，需 migration + verify 雙 path backward compat |
| M (Unicode email NFKC) | 需 audit 所有 email 比對 callsite + 寫入端統一 helper |
| M (PKCE for confidential) | OAuth 2.1 mandatory but breaks existing confidential clients without grace period |
| M (Host header origin trust) | env-driven `PUBLIC_ORIGIN` 改 secret config + audit ~12 callsite |
| M (forgot-password timing) | sendEmail 改 `waitUntil()` 失敗訊息變 silent，需評估 UX |
| LOW (payload size cap / JWKS KV / CryptoKey cache / INVITATION_TTL drift) | 純優化，無 security urgency |

## Status

- ✅ 4 CRITICAL + 3 HIGH + 4 MED security fix
- ✅ 3 個 CRITICAL ZERO_COVERAGE 補測試
- ✅ tsc clean
- ✅ 2478 / 2478 全綠 (+75)
- ✅ #131 closes
