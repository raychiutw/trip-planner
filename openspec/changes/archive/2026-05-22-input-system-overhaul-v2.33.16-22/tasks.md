# Tasks (retroactive — shipped 2026-05-22)

## v2.33.16 — Input 二系統 (PR #692)

- [x] `css/tokens.css @layer base` 加 `.tp-input-long` + `.tp-input-short`
- [x] Migrate 7 short callsites (NewTrip dates × 2, EditTrip shift date,
      AddPoiFavoriteToTrip times × 2, AddCustomStop time + duration,
      AddStopPage 預估停留, TravelPillDialog transit min, EditEntryPage transit min)
- [x] sign-off mockup: `docs/design-sessions/2026-05-21-input-full-inventory/two-styles-proposal.html`

## v2.33.17 — TripDatePicker + TripSelect (PR #693)

- [x] Install `react-day-picker@9` + `date-fns@4` + `@headlessui/react@2`
- [x] Build `src/components/TripDatePicker.tsx` + `.styles.ts`
- [x] Build `src/components/TripSelect.tsx` + `.styles.ts` (含 `variant: pill`)
- [x] Migrate 3 date callsites: NewTrip dates × 2, EditTrip shift modal
- [x] Migrate 6 select callsites: AddPoiFavoriteToTrip × 2, EditTripPage 顯示語言,
      EntryActionPage 時段, TripsListPage 排序 (pill), AddEntryPage Day
- [x] Helper `tests/unit/__helpers__/tripSelect.ts`
- [x] 12 unit tests (6 each); 9 affected tests refactored (`fireEvent.change` → click pattern)
- [x] `tests/setup-jest-dom.js` 加 ResizeObserver stub (@headlessui 需要)
- [x] sign-off mockup: `docs/design-sessions/2026-05-22-calendar-select-mockup/` Variant B Spacious

## v2.33.18 — e2e pickDate helper (PR #694)

- [x] `tests/e2e/_helpers/pickDate.js` — click trigger + navigate month + click day
- [x] Update `tests/e2e/qa-flows.spec.js` Flow 1 to use helper

## v2.33.19 — `.tp-select` class collision fix (PR #695)

- [x] Prod QA 截圖發現 dual chevron on 5 TripSelect callsites
- [x] Remove `.tp-form-row > select` + `.tp-select` legacy CSS (v2.31.81)
      from `css/tokens.css` (3 blocks)
- [x] Verify 5 callsites still render correctly (1 chevron only)

## v2.33.20 — companion-resolver hookTimeout (PR #696)

- [x] `tests/unit/companion-resolver.test.ts` `beforeAll(..., 30_000)`
- [x] Push v2.33.19 prod QA 5/5 verify 截圖到 docs/design-sessions

## v2.33.21 — TripTimePicker (PR #697)

- [x] Build `src/components/TripTimePicker.tsx` + `.styles.ts`
      (Popover + 2-col scrolling lists, minuteStep prop, scrollIntoView center)
- [x] Migrate 5 time callsites: AddCustomStop, AddPoiFavoriteToTrip × 2, EditEntry × 2
- [x] Helper `tests/unit/__helpers__/tripTimePicker.ts`
- [x] 8 unit tests; 7 affected tests refactored

## v2.33.22 — page-scoped CSS cleanup (PR #698)

- [x] Remove dead `.tp-favorites-add-to-trip .tp-form-select` / `.tp-form-input`
- [x] Remove dead `.tp-add-entry-daypicker-select`
- [x] Remove dead `.tp-shift-modal-input`
- [x] EditEntry 抵達/離開 wrapper: `<label>` → `<div>`, 拔 border/padding 避免 double frame
- [x] AddCustomStop 標題 input: `.tp-custom-stop-input` → `.tp-input-long`
- [x] Update `edit-entry-time-row-overflow.test.ts` assertion 反轉

## QA (prod verify)

- [x] 7 個 callsite 截圖 (qa-1 to qa-7)
- [x] dual-chevron fix verify (qa-2/4a/4b/5/6/7 post-v2.33.19)
- [x] 5/5 TripSelect callsites only 1 chevron
- [x] 3/3 TripDatePicker callsites terracotta calendar
- [x] 5/5 TripTimePicker callsites terracotta time picker
