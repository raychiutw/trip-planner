# Input System Overhaul — Terracotta Calendar / Select / Time (v2.33.16-22)

**Retroactive archive** — 7 個 PR 已 ship 才補 OpenSpec（CLAUDE.md hard rule
「Post-ship retroactive OpenSpec archive if PR didn't propose first」）。

PR：#692 #693 #694 #695 #696 #697 #698（v2.33.16-22）。

## Why

v2.31.81 #3 把 native `<select>` 用 `appearance: none + background-image:
data:image/svg... chevron` 美化成 site-style pill，但這只解決 trigger 視
覺。**彈出層 (popup) 仍是 OS chrome**：

- iOS Safari `<input type="date">` 跳出 wheel drum / `<input type="time">`
  跳出 rotating drum
- macOS Safari `<select>` 跳出 native dropdown（rounded corner 不同）
- Chrome 桌面 `<select>` 跳出 native blue-focus list

跨平台不一致也與 Terracotta design system 衝突。User feedback：「目前
日曆 跟 select 還是用原生的 要改成網站風格」。

唯一根本解 = 替換成 React 自訂 component（headless library + 自己 popover）。

## What Changes

### v2.33.16 — Input 二系統 (`.tp-input-long` / `.tp-input-short`)

Foundation。把 74 個散落 input 收斂到 2 種 class：

- `.tp-input-long` — 一般文字 (email/password/標題/地址/textarea/長 select)
  - padding 12 14, border 1.5px, radius lg, bg secondary, font body, left align
- `.tp-input-short` — 固定格式短值 (time/date/短 number)
  - 22px bold center, 44px tap target, radius md

Migrated 7 short callsites (date inputs, time inputs, duration number)。長
inputs 維持靠 `:where()` base layer 視覺等效（v2.33.12）。

### v2.33.17 — TripDatePicker + TripSelect

Calendar + select popup → headless library + terracotta theme：

- `react-day-picker@9` 包裝成 `TripDatePicker`（44px cell, 中文 weekday/month,
  terracotta accent today/selected）
- `@headlessui/react@2` Listbox 包裝成 `TripSelect`（44px row,
  accent-subtle hover, `variant: 'default' | 'pill'`）

Migrated：
- 3 date callsites: NewTripPage 出發/回程, EditTripPage shift modal
- 6 select callsites: AddPoiFavoriteToTrip × 2, EditTripPage 顯示語言,
  EntryActionPage 時段, TripsListPage 排序 (pill), AddEntryPage Day

### v2.33.18 — e2e pickDate helper (regression fix)

v2.33.17 把 `<input type="date">` 換成 button-based TripDatePicker 後，
Playwright Flow 1 `getByTestId(...).fill('YYYY-MM-DD')` 失敗。新
`tests/e2e/_helpers/pickDate.js` 點 trigger + navigate month + 點 day。

### v2.33.19 — `.tp-select` class collision fix

Prod QA 截圖發現 TripSelect 上有兩個 chevron — wrapper `<div className="
tp-select">` 與 v2.31.81 native `<select>` chrome CSS 同名。Fix：刪除
legacy `.tp-form-row > select` + `.tp-select` 規則（無 callsite 用 native
select）。

### v2.33.20 — `companion-resolver.test.ts` hookTimeout

CI flaky `Hook timed out in 10000ms` 在 `beforeAll createTestDb`。Fix：
明確 30s budget。獨立 PR 但同 session 修。

### v2.33.21 — TripTimePicker

完成 calendar + select + time 三件套。`@headlessui/react` Popover + 2-col
scrolling lists (hour 0-23 + minute 0-55 by `minuteStep` default 5)。

Migrated 5 callsites: AddCustomStop, AddPoiFavoriteToTrip × 2, EditEntry × 2。

### v2.33.22 — page-scoped CSS cleanup

v2.33.16-21 換 Trip* components 後，多支 page 的 page-scoped CSS rules 已
dead。本次 sweep：

- AddPoiFavoriteToTripPage: `.tp-form-select` / `.tp-form-input` 整批
- AddEntryPage: `.tp-add-entry-daypicker-select`
- EditTripPage: `.tp-shift-modal-input`
- EditEntryPage 抵達/離開: wrapper double-frame 修復 + label tag → div

## Capabilities Added

### Components

- `src/components/TripDatePicker.tsx` + `.styles.ts` — terracotta calendar
- `src/components/TripSelect.tsx` + `.styles.ts` — terracotta dropdown
- `src/components/TripTimePicker.tsx` + `.styles.ts` — terracotta time picker

### Tokens

- `css/tokens.css @layer base` 加 `.tp-input-long` + `.tp-input-short` 系統 class

### Test helpers

- `tests/unit/__helpers__/tripSelect.ts` — `pickFromTripSelect(testId, matcher)`
- `tests/unit/__helpers__/tripTimePicker.ts` — `pickTime(testId, 'HH:MM')`
- `tests/e2e/_helpers/pickDate.js` — Playwright `pickDate(page, testId, iso)`

## Dependencies Added

- `react-day-picker@9` — calendar grid
- `date-fns@4` — peer dep
- `@headlessui/react@2` — Listbox + Popover (accessibility + portal)

## Not in Scope (DEFER)

- 沖繩 7/26 trip offline tile cache (PR3) — 獨立提案（Workbox + map tile
  caching, big scope）
- iOS native time picker drum 改成 web 介面但保留觸感 — 不做（current
  2-col list 已夠用）

## Tests

- vitest 269 files / 2082 tests pass（含 8 個新 TripDatePicker test +
  6 個 TripSelect test + 8 個 TripTimePicker test）
- 9 個 affected source-grep / interaction tests 反轉 assertion（時間 input
  改 click pattern）
- e2e qa-flows.spec.js Flow 1 改用 pickDate helper（CI pass）
