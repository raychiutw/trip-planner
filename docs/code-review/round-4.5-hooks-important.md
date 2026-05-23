# Round 4.5 — src/hooks/ IMPORTANT + test gap

- **PR**: [#719](https://github.com/raychiutw/trip-planner/pull/719)
- **Version**: v2.33.40
- **Date**: 2026-05-23
- **Scope**: src/hooks/ round 1 IMPORTANT findings + top-2 test gap

## Findings

### IMPORTANT

| # | Location | Issue | Status |
|---|----------|-------|--------|
| I1 | `useDarkMode.ts:45-46` | double `readColorMode()` 初始 (2 個 useState initializer 各跑一次 localStorage 讀) | ✅ Fixed: `resolveDark(colorMode)` 共享 first init |
| I2 | `useChatPagination.ts:81` | 5 個 callback (setMessages / rowToMessages / isInflightStatus / onInitialResume / setHistoryLoading) 依賴「caller 傳穩定 ref」implicit contract | ✅ Fixed: 全 stash 到 ref |
| I3 | `usePullToRefresh.ts:119` | `onRefresh` 在 effect dep — inline arrow 每 parent render 重綁 4 touch listener | ✅ Fixed: ref pattern + 拔 dep |
| I4 | `usePlacesAutocomplete.ts:48-52` | Module-level Map cache 無界限 long-typing 後變幾百 entry | ✅ Fixed: 50-entry LRU cap (`cacheGet` touch / `cacheSet` evict) |

### Tests (+13)

- `use-permissions.test.tsx` — 6 case 含 race guard via currentTripIdRef
- `use-dark-mode-body-class.test.tsx` — 7 case v2.31.25 regression guard

### Skipped (rationale)

| # | Issue | Reason |
|---|-------|--------|
| S1 | `useTripSegments` unused state when fromCtx non-null | restructure 成本 > 收益（context 命中時 trivial cost）|
| S2 | `useNavigateBack` `history.length > 1` unreliable | 需 RouterProvider 全頁面 audit + 共用 fallback 策略，獨立 PR |
| S3 | `useTrip.refetchDay` 完整 test | Round 6+ 補 |
| S4 | `usePoiSearch` 完整 test | Round 6+ 補 |
