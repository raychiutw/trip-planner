# Round 7a — src/pages/ HIGH security

- **PR**: [#725](https://github.com/raychiutw/trip-planner/pull/725) (TBD)
- **Version**: v2.33.46
- **Date**: 2026-05-24
- **Scope**: src/pages/ — 33 .tsx files / 20,110 LOC（最大模組）
- **Agents**: code-reviewer + security-auditor + test-engineer

## Findings handled in this PR

### HIGH security (security-auditor flagged)

| # | Location | Issue | Status |
|---|----------|-------|--------|
| HS1 | `SessionsPage.tsx:348` | Logout via `<a href="/api/oauth/logout">` GET — any forum/chat `<img src=...>` 即可登出 victim (CSRF logout DoS) | ✅ Fixed: 改 POST button via `apiFetchRaw + navigate('/login', {replace})` 對齊 AccountPage 既有 pattern |
| HS2 | `EditEntryPage.tsx:1232` | `<a href={alt.reservationUrl}>` 無 scheme check + 只 `rel="noreferrer"` — co-editor 可寫 `javascript:` URI 或 tabnabbing | ✅ Fixed: `escUrl(reservationUrl)` + `rel="noopener noreferrer"` |
| HS3 | `ConsentPage.tsx:134` | `app_name = clientId` 直接反映 URL `?client_id=` → attacker 構 `Tripline Official Login` 字串騙 user click Allow | ✅ Fixed: 顯「未知應用程式 (client_id=...)」+ 不信 URL 來的 app_name，直到 `/api/oauth/client-info` endpoint 上線 |

### HIGH effect bug (code-reviewer flagged)

| # | Location | Issue | Status |
|---|----------|-------|--------|
| HE1 | `TripPage.tsx:529` | 300ms `setTimeout` 沒 cleanup — rapid nav away fire `scrollIntoView` on stale DOM (latent leak pattern) | ✅ Fixed: rAF + setTimeout 收 cleanup `cancelAnimationFrame + clearTimeout` |
| HE2 | `LoginPage.tsx:344` | Countdown timer `setInterval` 純 -1 counter — tab background throttling 後 absolute time 已過卻沒減 | ✅ Fixed: `Date.now()` baseline via `lockedUntilRef` + `Math.ceil((until - Date.now()) / 1000)` |

### MEDIUM security

| # | Location | Issue | Status |
|---|----------|-------|--------|
| MS1 | `ConsentPage.tsx:121` | Scope 任意字串 render — 訓練 user 忽略 safety prompt | ✅ Fixed: `KNOWN_SCOPES` allowlist + 未知 scope 顯「⚠ 未知範圍 — 請勿授權」+ cap 64 char |
| MS2 | `ConsentPage.tsx:215` | `redirect_uri` 無 client-side validation | ✅ Fixed: `isPlausibleRedirectUri()` 強制 https/http (defense in depth — backend 是 source of truth) |
| MS3 | `ChatPage.tsx:904` | `m.markdown` flag 從 backend 來 — 若 user message column 誤標 markdown=1，collaborative trip 內 co-editor 可注入 markdown 給 victim | ✅ Fixed: 限 `m.role === 'assistant'` 才走 MarkdownText path |

## Tests added (+11)

- `round7a-security.test.tsx` — source-grep wiring 7 個 fix + behavior assertions

## Deferred to round 7b (HIGH + MED + LOW)

從 code-reviewer 報告剩餘 HIGH:

| # | Location | Issue | Reason for defer |
|---|----------|-------|------------------|
| 7b1 | `ChatPage.tsx:601` | `useEffect([])` 內讀 `activeTripId` stale closure (strict-mode double-mount) | 需 ref refactor |
| 7b2 | `EditEntryPage.tsx:1131` | Global `keydown` `⌘+Enter/⌘+S/Esc` 沒 check inner modal/textarea focus | 需 modal stack awareness |
| 7b3 | `AccountPage.tsx:188` | logout 失敗 modal 卡住、auth context 沒 reset | 需 currentUser context 改 setCurrentUser(null) |

MED from code-reviewer:

| # | Location | Issue |
|---|----------|-------|
| 7b4 | LoginPage.tsx:293 | navigate/window.location.href mix |
| 7b5 | ChatPage.tsx:541 | prefill effect ref guard |
| 7b6 | ChatPage.tsx:715 | send useCallback 缺 user deps |
| 7b7 | TripPage.tsx:354 | useTripSegments ref stability |
| 7b8 | TripHealthCheckPage.tsx:539 | polling race on remount |
| 7b9 | EditEntryPage.tsx:802 | dirty state 被 segment refresh 蓋掉 |
| 7b10 | EditTripPage.tsx:730 | refetchDays silent err swallow |
| 7b11 | AddStopPage.tsx:917 | handleConfirm stale closure (eslint disable) |
| 7b12 | AddStopPage.tsx:907 | recompute-travel 缺 debounce |
| 7b13 | AddStopPage.tsx:724 | mobile redirect 沒 ref guard |
| 7b14 | ConsentPage.tsx:112 | 缺 useRequireAuth |
| 7b15 | InvitePage.tsx:140 | window.location.href vs navigate inconsistency |
| 7b16 | SessionsPage.tsx:184 | err instanceof Error 死 check |
| 7b17 | TripHealthCheckPage.tsx:622 | counts 缺 useMemo |
| 7b18 | DeveloperAppNewPage client_secret in DOM | 加 5min auto-clear |

LOW:

| # | Location | Issue |
|---|----------|-------|
| 7b19 | LoginPage.tsx:230 | `failureCount` lazy init via useState(()=>sessionStorage.getItem) |
| 7b20 | SignupPage.tsx:97 | 加 auth-redirect-if-logged-in early bounce |
| 7b21 | ChatPage.tsx:836 | `buildMessagesWithDividers(messages)` 缺 useMemo |
| 7b22 | TripPage.tsx:443 | `activeTripId.split('-')[0]` tripId prefix brittle |
| 7b23 | EditEntryPage.tsx:843 | handleSave 13 deps — extract payload builder |
| 7b24 | EditTripPage.tsx:1085 | `formRef.current?.requestSubmit()` Safari ≤15.4 fallback |
| 7b25 | AccountPage.tsx:182 | stats 顯 retry control |
| 7b26 | ResetPasswordPage strengthLevel | 重新 weighting |
| 7b27 | EmailVerifyPendingPage.tsx:99 | visibility-state pause interval |
| 7b28 | EditTripPage.tsx:709 | poiSearch error clear race |

Test gaps deferred to round 7c:

| Page | Priority | Reason |
|------|----------|--------|
| `NewTripPage.tsx` (932 LOC) | CRITICAL | Zero test，primary onboarding，獨立 PR |
| `TripPage.tsx` focusId / TripSegmentsContext | HIGH | v2.31.93 just shipped，需 page-level test |
| `EditTripPage.tsx` defaultTravelMode camelCase regression | HIGH | v2.31.15 family |
| `ChatPage.tsx` SSE/polling fallback | HIGH | v2.31.6 silent-cardiac-arrest 領域 |
| `AddPoiFavoriteToTripPage.tsx` full add-to-trip | HIGH | 575 LOC slice-only |

## Won't fix (留 rationale)

| # | Issue | Reason |
|---|-------|--------|
| W1 | `LoginPage.tsx:236` failure counter client-controllable | UX-only，actual lockout 在 server side enforce |
| W2 | `LoginPage.tsx:293` window.location.href invitation accept | Full reload 對 invitation flow 是 intentional (clean React state) |
| W3 | `DeveloperAppNewPage` client_secret in DOM | Industry standard (GitHub/Stripe 同) — acceptable trade-off，文件警告即可 |
| W4 | `ResetPasswordPage.tsx` token in URL → browser history | 必要 email-link reset flow，backend single-use token 已防 |
| W5 | `InvitePage.tsx:122` error.detail 含 invitedEmail | By-design feature (token-bearer access)，7-day TTL + single-use |
| W6 | `noValidate` on auth forms | Backend validates，client UX 已 cover 大部分 |
| W7 | Inline `<style>` blocks CSP | Deployment-level concern，CSP-strict 升級時統一處理 |

## Positive observations

- `sanitizeRedirectAfter` (v2.33.39) properly rejects whitespace-prefix / backslash / `%2f` / `%5c` / protocol-relative — 強硬化
- 所有 `apiFetch` URL params 用 `encodeURIComponent` (verified)
- `sanitize.ts` (v2.33.36) 拔 style attr / 加 URI allowlist
- `MarkdownText` 是 single render path for sanitized content
- Auth pages 用 `autoComplete="current-password"` / `"new-password"` 正確
- Anti-enumeration on ForgotPasswordPage (server 統一回 200 regardless of email exist)
- 33 pages 全 wrapped in `lazyWithRetry` — 強韌 dynamic import 失敗 recovery
