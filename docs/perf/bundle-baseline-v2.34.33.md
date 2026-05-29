# Bundle Size Baseline — v2.34.33 (2026-05-29)

Tracking gzipped JS chunk sizes after PR26-33 batch（audit + token + dep upgrade）。
Future PR diff against this baseline to catch unexpected bloat。

## Totals

| Metric | Value |
|---|---|
| Total gzipped JS | **720.9 KB** |
| Chunk count | 89 |
| Largest chunk | `pdf-*.js` 256 KB（lazy） |
| Bundle gate threshold | 300 KB per chunk |
| Gate result | ✓ 89/89 pass |

## Top 20 chunks (gzipped)

| Chunk | Size | Lazy? | Note |
|---|---|---|---|
| pdf-*.js | 256.1 KB | ✓ | html2pdf, only loaded on trip export to PDF |
| vendor-*.js | 68.7 KB | — | React + react-dom + react-router |
| sentry-*.js | 45.7 KB | — | Sentry SDK |
| TripsListPage-*.js | 37.7 KB | ✓ | landing page after login |
| headlessui-*.js | 34.6 KB | ✓ | dialog/menu primitives |
| datepicker-*.js | 21.6 KB | ✓ | react-day-picker |
| dndkit-*.js | 15.2 KB | ✓ | drag-reorder (trip-notes) |
| marked-*.js | 11.7 KB | ✓ | markdown rendering (chat replies) |
| TripNotesPage-*.js | 11.7 KB | ✓ | PR29 token cleanup result（lean）|
| EditEntryPage-*.js | 9.6 KB | ✓ | |
| index-*.js | 9.4 KB | — | entry bundle |
| EditTripPage-*.js | 9.2 KB | ✓ | |
| GlobalMapPage-*.js | 8.7 KB | ✓ | |
| ChatPage-*.js | 8.4 KB | ✓ | |
| ExplorePage-*.js | 8.1 KB | ✓ | |
| Icon-*.js | 8.0 KB | ✓ | lucide-react icons |
| AddStopPage-*.js | 7.8 KB | ✓ | |
| ChangePoiPage-*.js | 6.5 KB | ✓ | |
| NewTripPage-*.js | 6.4 KB | ✓ | |
| GlobalBottomNav-*.js | 6.2 KB | ✓ | mobile 5-tab nav |

## Observations

- **pdf-*.js 256 KB borderline 300 KB**: lazy-loaded only on export action，user 體感無影響但接近 gate threshold。Future: 考慮換 lighter PDF lib 或 server-side render
- **TripsListPage 37.7 KB**: first impression after login，largest visible page。Future: consider 拆 destination card filter / search 進獨立 chunks
- **sentry 45.7 KB**: eager-loaded for error tracking。Acceptable 但若想壓 first paint 可考慮 lazy init
- **vendor 68.7 KB**: React 19 + react-router 7。Lean
- **Total 720.9 KB**: well below typical SPA bundle budget（1MB+）。Healthy.

## Comparison gate

新 PR diff 對齊 baseline；超出 5% = warning，超出 10% = block。

Run:
```bash
npm run build
bash scripts/bundle-size-diff.sh docs/perf/bundle-baseline-v2.34.33.md
```
（script 待實作。目前 `scripts/bundle-size-check.sh` 只驗 single chunk ≤ 300KB。）
