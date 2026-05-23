# Round 2 — src/lib/ Architecture + Coverage

- **PR**: [#716](https://github.com/raychiutw/trip-planner/pull/716)
- **Version**: v2.33.37
- **Date**: 2026-05-24
- **Scope**: src/lib/ reverse imports + 3 high-leverage zero-test files

## Findings

### Architecture (HIGH — agent flagged)

| # | Location | Issue | Status |
|---|----------|-------|--------|
| A1 | `lib/mapDay.ts:6-9` | 4 個反向 import from `components/trip/{TimelineEvent,MapLinks,InfoBox,Shop}` — utility leaf module 不該依賴 React component | ✅ Fixed: 新 `src/types/timeline.ts` 集中 9 type, lib 改 import from types |
| A2 | `lib/timelineUtils.ts:8` | 同樣反向 import `TimelineEntryData` from components | ✅ Fixed: 改 import from types/timeline |
| A3 | `lib/tripExport.ts:7` | 反向 import `DOC_KEYS` from `hooks/useTrip` | ✅ Fixed: 新 `src/lib/docKeys.ts` extract，hooks re-export 向後相容 |
| A4 | `lib/tripExport.ts:8` | 反向 import `showToast` from `components/shared/Toast` (runtime) | 🔄 Deferred: 需 callback 注入 pattern，獨立 PR |
| A5 | `lib/apiClient.ts:3` | 反向 import `reportFetchResult` from `hooks/useOnlineStatus` (runtime) | 🔄 Deferred: 同上 |

### Coverage gaps (top-3 fixed)

| File | LOC | Coverage before | Status |
|------|-----|-----------------|--------|
| `poiCategory.ts` | 53 | source-grep only | ✅ +27 case unit |
| `poiSearchHelpers.ts` | 84 | 0 | ✅ +24 case unit (matchCategory/poiTone/poiMeta/normalizeSearchResults strict shape) |
| `travelMode.ts` | 24 | 0 | ✅ +7 case unit |

### Backlog (zero-test files for round 3+)

- `sentry.ts` 26 LOC (init side-effect, low value)
- `tripExport.ts` 272 LOC
- `dayArtMapping.ts` 118 LOC
- `weather.ts` 257 LOC
- `localStorage.ts` 68 LOC (covered in round 3)
- `entryAction.ts` 46 LOC
- `validateDay.ts` 51 LOC
- `mapDay.ts` 313 LOC
- `maps/cache.ts`
- Partial coverage: `sanitize.ts` (full XSS surface — round 6a 補在 components 層)
- Partial coverage: `apiClient.ts` (round 1 補 content-type, 缺 abort / error mapping)
