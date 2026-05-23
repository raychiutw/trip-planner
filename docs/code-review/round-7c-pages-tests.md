# Round 7c — src/pages/ critical test gap fill

- **PR**: [#727](https://github.com/raychiutw/keep-on/trip-planner/pull/727) (TBD)
- **Version**: v2.33.48
- **Date**: 2026-05-24
- **Scope**: src/pages/ — 補關鍵 zero-coverage page + 最近改動 regression guard
- **Continuation of**: [round-7a](./round-7a-pages-security.md) + [round-7b](./round-7b-pages-effect-bugs.md)

## Tests added (+22)

### `new-trip-page-smoke.test.tsx` (+13)

NewTripPage 932 LOC 原本**零測試** — onboarding 主流程 (CRITICAL gap per
test-engineer audit)。本檔 source-grep + wiring smoke：

- default export check
- `useRequireAuth` auth gate wired
- `useNavigate` + `useNavigateBack` wired
- 7 個關鍵 `data-testid` present (page / destination-input / dropdown /
  popular-dests / date-mode-select / date-mode-flexible / destination-rows)
- POST `/trips` endpoint wiring
- TripDatePicker mount
- localStorage recent-dests helpers
- dateMode 'select' | 'flexible' union type
- @dnd-kit/sortable + arrayMove import
- usePoiSearch hook 接 autocomplete
- ToastContainer + AppShell shell
- TitleBarPrimaryAction 建立按鈕
- v2.31.36 migration 0068 regression guard — `default_travel_mode` /
  `self_drive_*` 不該再寫入 (DROP COLUMN)
- v2.27.0+ schema regression — NewTripPage caller 不該帶 entry_pois_version

### `trip-page-focus-id.test.tsx` (+9)

v2.31.93 剛 shipped `?focus=<entryId>` deep-link flow (從 /map 點 POI 跳
過來)，test-engineer 點出 page-level wiring 沒 regression test (marker-side
有，但 TripPage 接 param 並 trigger scrollIntoView 路徑無 guard)。

- 讀 `?focus=` URL searchParam
- `data-scroll-anchor=entry-<id>` selector pattern
- `CSS.escape(focusParam)` 防 selector injection
- `scrollIntoView({ block: 'center' })` 對齊行為
- focusParam path early return (不走 fallback)
- `requestAnimationFrame` wrap (DOM commit 後才 query)
- `?sheet=collab` legacy redirect wiring
- v2.33.46 round 7a autolocate cleanup regression guard

## Skipped (rationale)

| Test gap | Status | Reason |
|----------|--------|--------|
| EditTripPage `defaultTravelMode` camelCase regression | ❌ Won't add | 該欄位 v2.31.36 migration 0068 已 DROP，regression risk = 0 (有意願再 add column 才需要 test) |
| ChatPage SSE/polling fallback integration | 🔄 Round 8 / e2e | full integration 需 mock useRequestSSE 全 state machine，e2e 較適合 |
| AddPoiFavoriteToTripPage add-to-trip flow | 🔄 Round 8 | 575 LOC form 完整 flow 需 mock 多 hook，獨立 spec |
| TripPage `TripSegmentsContext` provider 行為 | 🔄 Round 8 | useTripSegments context 已有 dedicated test (`use-trip-segments-context.test.tsx`)，page integration 可 defer |

## Existing tests reused

- `account-page.test.tsx` (v2.33.47 round 7b 更新 navigate `{ replace: true }`)
- `consent-page.test.tsx` (covers 既有 happy path — round 7a 加新 wiring 後仍綠)
- `developer-app-new-page.test.tsx`, `reset-password-page.test.tsx`,
  `forgot-password-page.test.tsx`, `signup-page.test.tsx`, `login-page.test.tsx`,
  `email-verify-pending-page.test.tsx`, `invite-page.test.tsx`,
  `sessions-page.test.tsx`, `developer-apps-page.test.tsx`,
  `connected-apps-page.test.tsx` — 全綠

## Tests summary

- 2270/2270 unit pass (+22 round 7c 新增)
- 7a + 7b + 7c 累計 +41 case for src/pages (round 7a +11, 7b +0 new file
  只更新既有, 7c +22 + 累計 8 個 round 7a fix 的 source-grep guard)

## Round 7 closure

src/pages review 三輪完成：
- **7a**: HIGH security (CSRF logout / reservationUrl XSS / app_name spoofing)
  + 2 HIGH effect bug + 3 MED security
- **7b**: 3 HIGH effect bug (ChatPage stale closure / EditEntryPage keydown /
  AccountPage logout) + selective MED + 3 LOW
- **7c**: NewTripPage smoke + TripPage focusId regression

剩 13 MED + 7 LOW + 4 remaining test gap 列在 [round-7b
doc](./round-7b-pages-effect-bugs.md) 7c section，下批次 (round 7d 或散落到
其他 PR) 處理。

任務 #114 src/pages review 整體 marked completed。
