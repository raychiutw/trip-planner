## 1. URL param helper

- [x] 1.1 寫 failing test：`parseSheetParam(search)` 回 tab 名 or null（invalid → null）
- [x] 1.2 寫 failing test：`setSheetParam(navigate, tab)` replace URL 不 push
- [x] 1.3 寫 failing test：`closeSheet(navigate)` 移除 sheet param
- [x] 1.4 建 `src/lib/trip-url.ts` 實作上述 helper

## 2. TripSheet component

- [x] 2.1 寫 failing test：TripSheet 讀 `?sheet=ideas` 展開並顯示 Ideas tab
- [x] 2.2 寫 failing test：TripSheet 無 sheet param 預設 Itinerary tab 展開
- [x] 2.3 寫 failing test：TripSheet `?sheet=foo` 無效值降級為 Itinerary（不 throw）
- [x] 2.4 寫 failing test：切 tab 用 replace，history length 不增
- [x] 2.5 寫 failing test：close X 清 sheet param
- [x] 2.6 建 `src/components/trip/TripSheet.tsx` 實作
- [x] 2.7 建 `src/components/trip/TripSheetTabs.tsx`（4 tab headers）

## 3. 各 tab content

- [x] 3.1 `<ItineraryTabContent>`：既有 timeline render 移動到此 component
- [x] 3.2 `<IdeasTabContent>`：呼叫 `GET /api/trip-ideas`，cards list + `+ Add` button
- [x] 3.3 `<IdeasTabContent>`：Add modal form（title + note + poi autocomplete）
- [x] 3.4 `<IdeasTabContent>`：「排入行程」button → day picker + 時段 input + PATCH API
- [x] 3.5 `<MapTabContent>`：wrap 既有 `<TripMapRail>` 不動邏輯
- [x] 3.6 `<ChatTabPlaceholder>`：顯示佔位文案

## 4. 301 redirect

- [x] 4.1 寫 failing E2E test：訪問 `/trip/:id/map` 自動 navigate 到 `/trip/:id?sheet=map`
- [x] 4.2 `src/entries/main.tsx` 新增 `<Route path="/trip/:id/map" element={<Navigate to=... replace />} />`
- [x] 4.3 驗證 Navigate 保留 trip id（用 `useParams` 注入）

## 5. TripPage 整合

- [x] 5.1 寫 failing test：TripPage render AppShell with `<TripSheet>` in sheet slot
- [x] 5.2 refactor `src/pages/TripPage.tsx` 移除直接 render MapRail，改傳 TripSheet 給 AppShell
- [x] 5.3 Itinerary timeline state + trip data props drill down 到 ItineraryTabContent

## 6. E2E + 驗證

- [x] 6.1 Playwright: 開 `/trip/:id?sheet=ideas` → 驗 Ideas tab 顯示
- [x] 6.2 Playwright: 切 tab → 驗 URL query 跟著變
- [x] 6.3 Playwright: back button → 驗 tab 不 replay，回到上一頁
- [x] 6.4 Playwright: 訪問舊 `/trip/:id/map` → 驗 redirect 到 `?sheet=map`
- [x] 6.5 `npm run typecheck` + 所有 test 綠
- [x] 6.6 `/design-review` 確認 sheet 視覺對齊 DESIGN.md + Mindtrip pattern
- [x] 6.7 `/tp-team` pipeline pass
- [x] 6.8 Staging → prod ship
