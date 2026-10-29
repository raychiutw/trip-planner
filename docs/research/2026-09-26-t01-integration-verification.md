# T01 integration verification (#1308)

Baseline: `b318f37d31a978a206f5cafb7fdb61ae2b8a9446` on `master`, after #1297–#1303 landed through PRs #1357–#1363. This is a verification pass of the existing implementations. The only new behavioral protection is the browser test for per-trip unsent chat drafts in `tests/e2e/active-trip-continuity.spec.js`.

## Acceptance mapping

Criterion numbers below follow each linked issue's **Acceptance criteria** in order. Earlier implementation and TDD evidence remains in the linked PR; current tests verify the integrated result.

| Issue | Criteria | Integrated evidence |
| --- | --- | --- |
| [#1297](https://github.com/raychiutw/trip-planner/issues/1297) | 1, 2, 4 | `tests/api/trip-import-creation.integration.test.ts`: real import request to local D1, 60 entries, multiple days, hotel, master/alternates, notes, segments, audit. Existing import format tests remain in API suite. |
| #1297 | 3 | PR #1357 places batch order, ID remap, POI tracking, and compensation in the shared trip creation owner; import retains format validation. |
| #1297 | 5, 6, 7 | Same real D1 suite injects day/entry/junction/hotel/segment failures, including after the first 50 entries commit, then checks cleanup, retry, compensation failure, and shared POI fill-null behavior. |
| #1297 | 8 | Import authorization/validation/limits and day replacement/clone regressions in the API suite; no schema or cross-batch atomicity claim. |
| #1297 | 9, 10 | TDD, review, branch PR, and domain document changes in [PR #1357](https://github.com/raychiutw/trip-planner/pull/1357); current full checks below. |
| [#1298](https://github.com/raychiutw/trip-planner/issues/1298) | 1, 8 | PR #1358 routes clone through the same creation owner, while import and clone real D1 suites run together. |
| #1298 | 2, 4, 5 | `tests/api/share-clone-creation.integration.test.ts`: owner/source isolation, visible-only notes, POI fields, hotel, segments, versions, and audit on local D1. |
| #1298 | 3 | Same suite covers unknown/revoked/expired links, unauthenticated/restricted users, rate limit, and trip limit. |
| #1298 | 6, 7 | Same suite covers 60-entry batch, late failure, compensation failure, retry, source protection, and shared POIs; import suite checks the shared behavior from its own entrance. |
| #1298 | 9, 10 | TDD, review, branch PR, and domain document changes in [PR #1358](https://github.com/raychiutw/trip-planner/pull/1358); current full checks below. |
| [#1299](https://github.com/raychiutw/trip-planner/issues/1299) | 1, 2, 3, 4 | `tests/unit/segment-lifecycle.integration.test.tsx`: real trip page and segment owner with controlled HTTP; loading/error, actual gaps, day scope, coordinates, optimistic sort, single-flight, duplicate suppression, 403, and retry. |
| #1299 | 5, 6 | Same suite checks saved entry plus failed recalc; `tests/unit/entry-visible-synchronization.test.tsx` checks cross-day move/copy and visible updates. |
| #1299 | 7 | Both suites cover A→B→A and late results without stale content, prompts, or navigation. |
| #1299 | 8, 9 | Existing manual edit and Google-only transit tests remain in the unit/API suites; PR #1360 adds the shared write owner without changing route calculation. |
| #1299 | 10, 11 | TDD, review, branch PR, and domain document changes in [PR #1359](https://github.com/raychiutw/trip-planner/pull/1359); current full checks below. |
| [#1300](https://github.com/raychiutw/trip-planner/issues/1300) | 1, 2 | `tests/unit/segment-writes.integration.test.tsx` exercises both actual edit UIs with the shared write owner: create/update, refresh, visible result, and failure. |
| #1300 | 3, 4 | Same suite and retained existing tests cover travel modes, minutes, no-transit, auto mode, autosave, close, conflict, and caller-specific version behavior. |
| #1300 | 5, 6, 7 | Same suite controls late/failed responses, camelCase conflict reread, rapid edits, trip switch, and partial save without replaying the successful write. |
| #1300 | 8 | Segment lifecycle integration suite runs with both edit UIs; no backend route calculation or provider change. |
| #1300 | 9, 10 | TDD, review, branch PR, and domain document changes in [PR #1360](https://github.com/raychiutw/trip-planner/pull/1360); current full checks below. |
| [#1301](https://github.com/raychiutw/trip-planner/issues/1301) | 1, 2 | `tests/unit/active-trip-selection.integration.test.tsx`: actual chat/sidebar/provider, shared private-trip metadata and list lifecycle, loading/error/empty and newer-result priority. |
| #1301 | 3, 4 | Same suite checks preference fallback, explicit chat target, and embedded trip-sheet target. |
| #1301 | 5, 6 | Same suite checks switching, remount, cross-tab storage, update events, and stale response ordering; `tests/e2e/active-trip-continuity.spec.js` checks browser navigation/reload and per-trip chat drafts. |
| #1301 | 7, 8, 9 | Actual pages and retained chat/send tests run; PR #1361 keeps ActiveTripContext/persistence and compatible notifications. |
| #1301 | 10, 11 | TDD, review, branch PR, and domain document changes in [PR #1361](https://github.com/raychiutw/trip-planner/pull/1361); current full checks below. |
| [#1302](https://github.com/raychiutw/trip-planner/issues/1302) | 1 | `tests/unit/trips-list-page.test.tsx` and browser continuity suite check one shared list read plus filter/search/sort. |
| #1302 | 2, 3, 4 | Both suites check explicit missing target, loading/error/empty, desktop last view versus mobile list, and date isolation. |
| #1302 | 5, 6 | Both suites check switcher/card URL, chat send target, private names, stale responses, and desktop host; `tests/e2e/trip-stack-no-remount.spec.js` and `trip-stack-scroll-sheet.spec.js` check host/scroll/sheet behavior. |
| #1302 | 7, 8 | Actual route/provider and page tests, independent of map migration; PR #1362 retained compatible map path. |
| #1302 | 9, 10 | TDD, review, branch PR, and domain document changes in [PR #1362](https://github.com/raychiutw/trip-planner/pull/1362); current full checks below. |
| [#1303](https://github.com/raychiutw/trip-planner/issues/1303) | 1, 2, 3 | `tests/e2e/active-trip-continuity.spec.js` checks shared list read, root redirect/empty/error, and explicit missing map URL. |
| #1303 | 4, 5 | Same browser suite checks map switch to chat/trips/reload, private names, stale preference, and late refresh. |
| #1303 | 6, 7 | Same suite counts one destination days read and no root-only duplicate; `tests/e2e/map-bottom-tabs.spec.js` checks day selection. Google-only map implementation remains. |
| #1303 | 8 | Browser continuity suite checks chat/sidebar/trips coexistence after map migration. |
| #1303 | 9, 10 | TDD, review, branch PR, and domain document changes in [PR #1363](https://github.com/raychiutw/trip-planner/pull/1363); current full checks below. |

## Current verification

- `npm ci` from the committed lockfile: passed.
- `npm run typecheck`, `npm run typecheck:functions`, `npm run lint`, `npm run build`, `npm run verify-sw`: passed.
- Unit suite: 490 files, 4,339 tests passed on the second clean-install run. First run had one 30-second setup timeout in `migration-0050-audit-log.test.ts`; isolated rerun passed 3/3.
- API suite: second full run had 1 Miniflare connection close among 1,267 tests in `day-replacement-integrity.integration.test.ts`; isolated rerun passed 15/15. A subsequent full run exposed a shared-D1 fixture collision: `my-trips.integration.test.ts` assumed `admin@test.com` had no trips, while `permissions.integration.test.ts` creates one for that user. The no-permission assertion now uses a dedicated principal. Final full API run passed 111 files, 1,267 tests.
- Browser: selected production-build Chromium specs cover active-trip continuity, day tabs, persistent trip host, sheet/scroll, and CSS variable resolution. Two local runs each had one different existing test fail transiently; both passed in isolation. The CI-configured run passed 22/22 without retries.
- `npm audit` reports 3 high severity advisories in the existing dev-only Miniflare dependency chain (`sharp`, `undici`). No dependency change is included in this integration ticket.

No new page, component, or layout was changed, so the prototype gate does not apply.
