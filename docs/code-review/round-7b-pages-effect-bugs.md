# Round 7b — src/pages/ effect bugs + LOW residuals

- **PR**: [#726](https://github.com/raychiutw/trip-planner/pull/726) (TBD)
- **Version**: v2.33.47
- **Date**: 2026-05-24
- **Scope**: src/pages/ — 處理 round 7a 留下的 3 個 HIGH effect bug + 部分 MED + 部分 LOW
- **Continuation of**: [round-7a-pages-security.md](./round-7a-pages-security.md)

## Findings handled

### HIGH effect bug

| # | Location | Issue | Status |
|---|----------|-------|--------|
| HE1 | `ChatPage.tsx:601` | `useEffect([])` 內讀 `activeTripId` stale closure (strict-mode double-mount 第二 pass 抓 initial value → clobber persisted ActiveTripContext) | ✅ Fixed: `activeTripIdRef` sync via separate effect + 讀 `activeTripIdRef.current` |
| HE2 | `EditEntryPage.tsx:1131` | Global `keydown` listener `⌘+Enter / ⌘+S / Esc` 沒 check inner modal/textarea focus → Esc-trap conflict (Escape 同時 fire 內外 modal cancel) | ✅ Fixed: guard `showDiscardModal \|\| altSwapConfirm` + skip TEXTAREA/INPUT for Escape + skip e.repeat |
| HE3 | `AccountPage.tsx:188` | Logout 失敗 modal 卡住、auth context 沒 reset、success/fail 都不關 modal | ✅ Fixed: success/fail 都 `setShowLogoutModal(false)`，失敗加 toast，success 用 `navigate('/login', {replace: true})` |

### MEDIUM (cherry-pick)

| # | Location | Issue | Status |
|---|----------|-------|--------|
| M1 | `AccountPage.tsx:184` | `(e as Error).message` 直接 surface backend detail → 可能 leak SQL / stack | ✅ Fixed: `ApiError` vs network 分支顯 generic 訊息 |

### LOW

| # | Location | Issue | Status |
|---|----------|-------|--------|
| L1 | `ChatPage.tsx:836` | `buildMessagesWithDividers(messages)` 每 keystroke 重 walk 整 list | ✅ Fixed: `useMemo([messages])` |
| L2 | `LoginPage.tsx:230` | `failureCount` mount-effect read → first paint 顯 0 然後 warning banner flash 進來 | ✅ Fixed: `useState(() => sessionStorage.get...)` lazy init |
| L3 | `EmailVerifyPendingPage.tsx:99` | 1Hz interval 不停 fire even on hidden tab → 浪費 battery | ✅ Fixed: pause on `visibilitychange` + catch-up tick on regain visible |

## Tests

- 既有 `account-page.test.tsx` 更新 navigate expect `{ replace: true }` 對齊新 contract
- 2248/2248 unit pass

## Round 7c/7d follow-up

從 round 7a doc 7b section 剩餘 MED：

| # | Location | Defer to | Reason |
|---|----------|----------|--------|
| 7c1 | LoginPage.tsx:293 navigate/window.location.href mix | 7d | 文檔化即可 |
| 7c2 | ChatPage.tsx:541 prefill ref guard | 7d | 風險 low |
| 7c3 | ChatPage.tsx:715 send useCallback 缺 user deps | 7d | 行為 low impact |
| 7c4 | TripPage.tsx:354 useTripSegments ref stability | 7d | hook 內部 issue |
| 7c5 | TripHealthCheckPage.tsx:539 polling race on remount | 7d | 已有 abort，理論問題 |
| 7c6 | EditEntryPage.tsx:802 dirty 被 segment refresh 覆蓋 | 7d | 邊界 case |
| 7c7 | EditTripPage.tsx:730 refetchDays silent err | 7d | UX polish |
| 7c8 | AddStopPage.tsx (3 finding) | 7d | 中型 page，分開處理 |
| 7c9 | ConsentPage.tsx:112 缺 useRequireAuth | 7d | 1-line fix 但需先確認 OAuth flow |
| 7c10 | InvitePage.tsx:140 window.location.href vs navigate | 7d | unify pattern |
| 7c11 | SessionsPage.tsx:184 err instanceof Error 死 check | 7d | 訊息 unification |
| 7c12 | TripHealthCheckPage.tsx:622 counts 缺 useMemo | 7d | 與 ChatPage useMemo 模式 |
| 7c13 | DeveloperAppNewPage client_secret 5min auto-clear | 7d | industry-standard 已 mitigate |

LOW 剩餘:

| # | Location | Issue |
|---|----------|-------|
| 7c14 | SignupPage.tsx:97 已登入 user 訪問 /signup 應 bounce | 7d |
| 7c15 | TripPage.tsx:443 tripId.split('-') brittle prefix | 7d |
| 7c16 | EditEntryPage.tsx:843 handleSave 13 deps 抽 payload builder | 7d |
| 7c17 | EditTripPage.tsx:1085 requestSubmit Safari ≤15.4 fallback | 7d |
| 7c18 | AccountPage.tsx:182 stats 顯 retry control | 7d |
| 7c19 | ResetPasswordPage strengthLevel re-weighting | 7d UX |
| 7c20 | EditTripPage.tsx:709 poiSearch error clear race | 7d |

Test gaps（round 7c 專注）:

| Page | Priority |
|------|----------|
| NewTripPage 932 LOC zero coverage | CRITICAL |
| TripPage focusId/TripSegmentsContext | HIGH |
| EditTripPage defaultTravelMode camelCase regression | HIGH |
| ChatPage SSE/polling fallback | HIGH |
| AddPoiFavoriteToTripPage full add-to-trip | HIGH |

## Won't fix this round

無 — 都是合理 finding，只是分批處理。
