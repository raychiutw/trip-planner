# Tasks (NOT STARTED — pending user sign-off)

## Pre-build (BLOCKED)

- [ ] User answers Open Questions 1-5 in proposal.md
- [ ] Office-hours brainstorm on Maps provider strategy
- [ ] `/tp-claude-design` mockup for `/trip/:id/offline` page + offline banner
- [ ] User sign-off mockup

## Phase 1 — Tile caching (3-5 days)

- [ ] Decide provider strategy (Google + Mapbox dual / pure Mapbox switch)
- [ ] If switch: rewrite `src/hooks/useGoogleMap.ts` → new `useMapTilerMap.ts`
- [ ] `public/sw.js` service worker registration + tile fetch interception
- [ ] `src/lib/offlineMap.ts` — Cache Storage helper + tile bbox enumeration
- [ ] `src/lib/serviceWorker.ts` — register / unregister / version mgmt
- [ ] Tests: unit (bbox + cache key) + integration (fetch intercept)

## Phase 2 — Pre-download UI (2-3 days)

- [ ] `src/pages/TripOfflinePage.tsx` — new route `/trip/:id/offline`
- [ ] UI: bbox preview, download button, progress meter (X/Y tiles, MB used)
- [ ] Settings: quota viewer + clear-cache button
- [ ] `src/main.tsx` route table 加 `/trip/:id/offline`

## Phase 3 — Offline banner + fallback (1-2 days)

- [ ] `src/components/trip/OfflineBanner.tsx` — appear on tile fail
- [ ] Link to `/trip/:id/offline` for pre-download
- [ ] Optional: static map fallback for fully offline scenarios

## Phase 4 — Tests + QA (1-2 days)

- [ ] Playwright E2E: trip detail → 離線 page → download → toggle offline → 地圖 render
- [ ] Manual QA: iPhone Safari + Android Chrome 模擬 offline
- [ ] **REAL device QA before 7/26 Okinawa trip departure**

## Phase 5 — Ship + release notes

- [ ] CHANGELOG entry
- [ ] PR with mockup + reviews
- [ ] /ship → /land-and-deploy → /canary monitor
