# Round 6a — src/components/ CRITICAL + HIGH

- **PR**: [#723](https://github.com/raychiutw/trip-planner/pull/723)
- **Version**: v2.33.44
- **Date**: 2026-05-24
- **Scope**: src/components/ — 63 files / 11,654 LOC

## Findings

### CRITICAL

| # | Location | Issue | Status |
|---|----------|-------|--------|
| C1 | `TimelineRail.tsx:873` | `useMemo(() => setOrderOverride(null), [eventsKey])` — side-effect masquerading as memo (React 19 concurrent / strict mode fires twice + warning) | ✅ Fixed: 改正確 `useEffect` |

### HIGH security

| # | Location | Issue | Status |
|---|----------|-------|--------|
| H1 | `StopLightbox.tsx:307` | `<a href={currentPhoto.source}>` 無 scheme check — pois.photos JSON 含 `javascript:` URI 即 XSS-on-click | ✅ Fixed: `escUrl()` wrap |

### MEDIUM security

| # | Location | Issue | Status |
|---|----------|-------|--------|
| M1 | `StopLightbox.tsx:269` | `<img src>` 無 referrerPolicy + 無 scheme guard | ✅ Fixed: `escUrl()` + `referrerPolicy="no-referrer"` + `crossOrigin="anonymous"` |
| M2 | `lib/mapDay.ts::parsePhotos` | 不 validate url/thumbUrl/source scheme | ✅ Fixed: `isSafePhotoUrl()` `https://` allowlist (defense in depth) |
| M3 | `ErrorPlaceholder.tsx:49` | `pendingErrorReports` localStorage write 含 `window.location.href`（含 query / fragment）→ share token / OAuth code 跨 session persist | ✅ Fixed: `new URL(...).pathname` 才存 |
| M4 | `ErrorBoundary.tsx:26` | `console.error` 在 prod 噴 stack — Sentry 已捕，prod leak filename/line | ✅ Fixed: gate `import.meta.env.DEV` |

### MEDIUM quality

| # | Location | Issue | Status |
|---|----------|-------|--------|
| Q1 | `HourlyWeather.tsx:64` | `weatherDayRef.current = weatherDay` 寫 ref during render — React anti-pattern (strict mode fires twice) | ✅ Fixed: 搬進 `useEffect` |

### Tests (+28)

- `markdown-text-xss.test.tsx` — 12 case end-to-end XSS pipeline (markdown → sanitize → DOM)
- `infobox-safetext.test.ts` — 10 case `safeText()` shape adapter
- `error-boundary.test.tsx` — 5 case fallback + Sentry wire + custom fallback + retry counter

## Findings deferred to round 6b/6c

(complete IMPORTANT + LOW list — see `round-6b-components-low.md`)
