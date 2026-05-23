# Round 3 — src/lib/ LOW priority cleanup

- **PR**: [#717](https://github.com/raychiutw/trip-planner/pull/717)
- **Version**: v2.33.38
- **Date**: 2026-05-24
- **Scope**: src/lib/ LOW findings from rounds 1 & 2

## Findings

### Hardening (defense in depth)

| # | Location | Issue | Status |
|---|----------|-------|--------|
| H1 | `errors.ts` | `ApiError.code` 缺 length cap | ✅ Fixed: 64-char cap |
| H2 | `errors.ts:sniffErrorCode` | `includes('admin')` 誤命中 "administered" / 「已系統管理員處理」 | ✅ Fixed: anchored phrase pattern (admin-only / administrator only / 僅(限)?管理(員\|者)) |
| H3 | `localStorage.ts:31` | `JSON.parse` 後 envelope shape 沒驗（exp string / NaN）| ✅ Fixed: `isLsEntry()` type guard |
| H4 | `localStorage.ts` | parse throw 不 remove 壞 entry → 下次再 retry parse | ✅ Fixed: catch path 也 removeItem |
| H5 | `routes.ts` | 無 shared `safeReturnTo()` helper | ✅ Fixed: 新 helper（擋 `//host` / abs URL / `\\` / non-string）|
| H6 | `poiSearchHelpers.ts` | `poiMeta` 「景點」fallback 硬寫字串（drift 風險）| ✅ Fixed: 改 `POI_TYPE_LABELS.attraction` |

### Cleanup

| # | Location | Status |
|---|----------|--------|
| C1 | `constants.ts` | ✅ 移除 unused `EXTERNAL_NAVIGATION_URL_BASE` |
| C2 | `drag-strategy.ts:93` | ✅ 新 `DEFAULT_START_MINUTES = 9*60` 取代 `!` non-null + double-parse |
| C3 | `mapDay.ts:230` | ✅ 移除 `(poi as { rating?... })?.rating` redundant cast |
| C4 | `lib/maps/region.ts:79` | ✅ `regionToCountryCode` 加 `@deprecated` (zero production caller) |

### Tests

- `routes-safe-return-to.test.ts` — 7 case open-redirect 攻擊面
- `errors-code-cap.test.ts` — 8 case 含 "administered by user" false-positive regression
- `local-storage-shape.test.ts` — 8 case (broken JSON / missing exp / wrong-type / NaN / non-object / null / expired / lsRemove)

### Won't fix (rationale)

| # | Location | Issue | Reason |
|---|----------|-------|--------|
| W1 | `localStorage.ts` LS_PREFIX | 'tp-' 太短 cross-app collision | Bump prefix 會 invalidate 既有 user data，LOW finding 不值 breakage |
| W2 | `weather.ts:148` | Record FIFO not LRU | 20 entries cap 已 enforce，FIFO vs LRU 差異不痛 |
| W3 | `weather.ts:102` | 1km filter 在赤道才精確 | Coarse filter 足夠 |
| W4 | `sanitize.ts` whitespace-prefix `\0javascript:` | DOMParser 已 normalize 防 |
| W5 | `dayArtMapping.ts` O(n²) keyword iteration | 60ms upper bound 不痛 |
