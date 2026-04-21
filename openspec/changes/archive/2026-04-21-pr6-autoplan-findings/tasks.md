# Tasks: PR6 — autoplan A+B Findings

## 執行順序

A 類先（critical bugs），再 B 類（quality improvements）。

---

## F001 — TripMapRail 加 `dark` prop

- [ ] 🔴 紅：寫測試 `tests/unit/trip-map-rail-dark.test.tsx`：mount `TripMapRail dark={true}` 驗證 `useLeafletMap` 收到 `dark: true`
- [ ] 🟢 綠：`TripMapRailProps` 加 `dark?: boolean`；`useLeafletMap({dark})` 加入；`TripPage.tsx` 傳 `dark={isDark}`
- [ ] 更新 `progress.jsonl`

## F002 — TripMapRail `fitDoneRef` 跨行程 reset

- [ ] 🔴 紅：寫測試 `tests/unit/trip-map-rail-fit-reset.test.tsx`：tripId 切換後 `fitBounds` 被重新呼叫
- [ ] 🟢 綠：在 `TripPage.tsx` 的 `<TripMapRail>` 加 `key={trip.id}` 讓 component 隨行程 ID 重掛
- [ ] 更新 `progress.jsonl`

## F003 — Mobile Type Scale 真正落地

- [ ] 🔴 紅：寫測試 `tests/unit/mobile-type-scale.test.ts`：驗證 `tokens.css` 在 `@media (max-width: 760px)` 下包含 `.ocean-hero-title` 24px override（目前 22px，需改為 24px）
- [ ] 🟢 綠：`css/tokens.css` `@media (max-width: 760px)` 下的 `.ocean-hero-title` 改為 24px；確認 `--mobile-font-size-*` tokens 在相關 class 有被套用
- [ ] 更新 `progress.jsonl`

## F004 — color-scheme: dark

- [ ] 🔴 紅：寫測試 `tests/unit/color-scheme.test.ts`：驗證 `tokens.css` 含 `color-scheme`
- [ ] 🟢 綠：`css/tokens.css` 加 `html { color-scheme: light dark; }`
- [ ] 更新 `progress.jsonl`

## F005 — TripMapRail React.lazy

- [ ] 🔴 紅：寫測試 `tests/unit/trip-map-rail-lazy.test.ts`：source-match 驗證 `TripPage.tsx` 含 `lazy(() => import` + `TripMapRail`
- [ ] 🟢 綠：`TripPage.tsx` 改 static import → `React.lazy`；用 `<Suspense fallback={null}>` 包住
- [ ] 更新 `progress.jsonl`

## F006 — TripMapRail marker click integration test

- [ ] 🔴 紅：在 `tests/unit/trip-map-rail-focus.test.tsx` 新增 integration case：real-map mock 下 marker click → navigate 被 called
- [ ] 🟢 綠：補強 mock map 物件（含 `on`, `off`, `remove`, `getZoom`, `setView`），讓 integration test 通過
- [ ] 更新 `progress.jsonl`

## F007 — TripMapRail scroll fly-to active day

- [ ] 🔴 紅：寫測試 `tests/unit/trip-map-rail-scroll-fly.test.tsx`：mock IntersectionObserver → trigger intersect → assert `map.panTo` / `fitBounds` called
- [ ] 🟢 綠：`TripMapRail.tsx` 加 IntersectionObserver 監聽各 day section；intersect 時 panTo 該天中心
- [ ] 更新 `progress.jsonl`

## F008 — 10 色 palette 加 color-blind aid

- [ ] 🔴 紅：寫測試 `tests/unit/dayPalette-accessibility.test.ts`：`dayPolylineStyle(1).dashArray !== dayPolylineStyle(2).dashArray`
- [ ] 🟢 綠：`src/lib/dayPalette.ts` 加 `dayPolylineStyle(dayNum)` helper 回傳 `{color, dashArray, weight}`；奇數天 solid，偶數天 dash；`TripMapRail.tsx` polyline 改用 helper
- [ ] 更新 `progress.jsonl`

## F009 — MobileBottomNav「訊息」改「助理」

- [ ] 🔴 紅：更新 `tests/unit/mobile-bottom-nav-entries.test.tsx` 期待「助理」label；新 test `screen.queryByLabelText('助理')` 存在
- [ ] 🟢 綠：`MobileBottomNav.tsx` label `訊息` → `助理`；aria-label 同步；icon 改 `message` → `ai` 或保留 `phone`（確認 DESIGN.md）
- [ ] 更新 `progress.jsonl`

## F010 — 看地圖 chip tap target 44px

- [ ] 🔴 紅：寫測試 `tests/unit/day-section-map-chip-tap.test.tsx`：驗證 `.day-map-chip` CSS 含 `min-height: 44px`
- [ ] 🟢 綠：`DaySection.tsx` MAP_CHIP_STYLES 加 `min-height: 44px; display: inline-flex; align-items: center;`
- [ ] 更新 `progress.jsonl`

## F011 — `map-page-day-query.test.tsx` runtime 化

- [ ] 🔴 紅：新增 runtime test cases：mount `MapPage` 在 `?day=2`、`?day=abc`、`?day=999` 三情境（先空殼可能 fail）
- [ ] 🟢 綠：補完 runtime test 所需 TripContext mock；測試通過；保留原 source-match 作 regression guard
- [ ] 更新 `progress.jsonl`
