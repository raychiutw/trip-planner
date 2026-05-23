# Round 4 — src/hooks/ Security + Quality

- **PR**: [#718](https://github.com/raychiutw/trip-planner/pull/718)
- **Version**: v2.33.39
- **Date**: 2026-05-23
- **Scope**: src/hooks/ — 24 .ts files / 2,650 LOC

## Findings

### CRITICAL

| # | Location | Issue | Status |
|---|----------|-------|--------|
| C1 | `useGoogleMap.ts:144-170` | `flyTo` / `fitBounds` non-memoised closure → OceanMap fitBounds effect dep 每次 re-fire | ✅ Fixed: `useCallback([map])` |
| C2 | `useTrip.ts:83-89` | `fetchDay` 直接 `allDaysRef.current[dayNum] = day` mutate ref，caller 讀 React state 看不到 cache | ✅ Fixed: `setAllDays((prev) => ...)` single writer |

### HIGH security

| # | Location | Issue | Status |
|---|----------|-------|--------|
| H1 | `useGoogleMap.ts:125` | hardcoded `'DEMO_MAP_ID'` in prod (Google demo ID 可隨時停用 + 跨 app 共用) | ✅ Fixed: `VITE_GOOGLE_MAPS_MAP_ID` env (DEMO_MAP_ID fallback for dev) |
| H2 | `LoginPage.tsx:210` (`sanitizeRedirectAfter`) | 漏 `\\` / `%2f` / `%5c` / whitespace prefix open-redirect | ✅ Fixed: extract to `src/lib/redirect.ts` + harden |

### MEDIUM

| # | Location | Issue | Status |
|---|----------|-------|--------|
| M1 | `useRequestSSE.ts:103-110` | `data.status` / `processedBy` blind cast — malformed payload silent UI hang | ✅ Fixed: `narrowStatus()` / `narrowProcessedBy()` runtime guard |
| M2 | `useRequestSSE.ts:129-150` | SSE `data.error` 無 length cap → multi-MB blast 寫 React state | ✅ Fixed: `clampErrorMessage()` 500 char + strip newline |
| M3 | `useRequestSSE.ts:115` | `pollOnce` 30s 才 fire 首次 — AI 健檢 7s SSE silent-fail 完成 user 等 30s | ✅ Fixed: `void pollOnce()` immediate fire |
| M4 | `usePoiSearch.ts:104` / `useRoute.ts:138` | bare `fetch` 繞過 `apiFetchRaw` → reportFetchResult 失效 | ✅ Fixed: 改 `apiFetchRaw` |
| M5 | `useRoute.ts:142` | `data.polyline` blind cast → cache poisoning IndexedDB 100 entries | ✅ Fixed: polyline shape validation |
| M6 | `useOnlineStatus.ts:11-29` | Module-level single-slot callbacks last-mount-wins clobber (StrictMode dev) | ✅ Fixed: `Set<callback>` registry |
| M7 | `useCurrentUser.ts:39` | 無 AbortController — rapid reload() slower wins race | ✅ Fixed: AbortController |
| M8 | `useRequestSSE.ts:86` | stale comment「1s tick」實 `ELAPSED_TICK_MS = 60_000` | ✅ Fixed: comment updated |

### LOW

| # | Location | Issue | Status |
|---|----------|-------|--------|
| L1 | `usePlacesAutocomplete.ts:84` | `crypto.randomUUID` 沒 feature-detect (Safari < 15.4 fail) | ✅ Fixed: feature-detect + time+random fallback |
| L2 | `useDarkMode.ts:21-28` | `lsGet<string>('dark')` legacy read 無 strict whitelist | ✅ Already gated by `readColorMode` explicit comparison |
| L3 | `useTrip.ts:150` | `mapRow(rawMeta) as unknown as Trip` cast 無 runtime narrow | 🔄 Deferred: same-origin trust boundary OK |
| L4 | `useScrollRestoreOnBack.ts:38` | `CSS.escape` usage | ✅ Already correct (positive observation) |

### Test gap (top-5)

| # | File | Priority | Status |
|---|------|----------|--------|
| T1 | `useRequireAuth.ts` | CRITICAL (auth gate) | ✅ +4 case auth gate (loading / authed / unauth / query+hash encode) |
| T2 | `usePermissions.ts` | HIGH | 🔄 Round 4.5 |
| T3 | `useTrip.refetchDay` | HIGH (cache invalidation) | 🔄 Round 4.5 |
| T4 | `usePoiSearch.ts` | HIGH (4 page user) | 🔄 Round 4.5 |
| T5 | `useDarkMode body-class effect` | MED (v2.31.25 regression risk) | 🔄 Round 4.5 |

## Tests added (+15)

- `redirect-sanitize.test.ts` — 10 attack vector
- `use-require-auth.test.tsx` — 4 auth gate case
