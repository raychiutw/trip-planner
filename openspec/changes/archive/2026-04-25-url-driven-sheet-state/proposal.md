## Why

Q4 locked：per-trip sheet 的 `/trip/:id/map` sub-route 跟 sidebar 的 `/map` (全局) 語意衝突，且無法 bookmark / share 特定 state（如「open Ideas tab」）。Mindtrip 的 `?sheet=map&tab=...` query param pattern 解這兩個問題 + back/forward button 自然運作。

Phase 2 已建 AppShell 有 sheet slot，此 Phase 把 sheet slot 從 `<TripMapRail />` 過渡方案換成真正的 `<TripSheet>` with tabs（Itinerary / Ideas / Map / Chat），全 URL-driven。

## What Changes

- **新增 `<TripSheet>` component**（`src/components/trip/TripSheet.tsx`）讀 `useSearchParams` 決定：
  - 是否展開（`?sheet=1` 或 `?sheet=<tab>` 即展開）
  - 當前 tab（`?sheet=itinerary|ideas|map|chat`）
- **新增 `<TripSheetTabs>` component** 切換 tab 時 update query param
- **TripPage sheet slot** 傳入 `<TripSheet>` 取代既有 `<TripMapRail>`（Phase 2 過渡方案）
- **既有 `/trip/:id/map` 路徑 301 redirect** 到 `/trip/:id?sheet=map`（backward compat 1-2 週後刪除 redirect）
- **Itinerary tab 內容**：既有 timeline content render 在 tab 內（不另建）
- **Map tab 內容**：既有 `<TripMapRail>` component render 於 sheet 裡
- **Ideas tab 內容**：Phase 1 建的 `trip_ideas` API 串接 UI（Ideas card list + Add button），無 drag（Phase 5）
- **Chat tab 內容**：Phase 3 占位「Phase 4+ 實作」

## Capabilities

### New Capabilities

- `trip-sheet-state`: per-trip sheet 的 open/close + tab 選擇全由 URL query param 驅動（`?sheet=<tab>`），所有 state transitions 可 deep-link / bookmark / browser back-forward

### Modified Capabilities

（無；既有 `/trip/:id/map` route 被 deprecated redirect，不是 modification，是 replace）

## Impact

- **新 files**：
  - `src/components/trip/TripSheet.tsx`
  - `src/components/trip/TripSheetTabs.tsx`
  - `src/components/trip/IdeasTabContent.tsx`
  - `src/components/trip/ChatTabPlaceholder.tsx`
- **修改 files**：
  - `src/pages/TripPage.tsx` — sheet slot 改用 TripSheet
  - `src/entries/main.tsx` — `/trip/:id/map` route redirect
  - `src/lib/trip-url.ts`（新）— query param helper functions
- **測試**：unit test for URL param parsing, E2E for back/forward button
- **依賴**：react-router-dom（既有）、Phase 1 的 trip_ideas API
- **Breaking**：既有 `/trip/:id/map` bookmark 變 301 redirect，短期內不影響使用者（redirect 保留 1-2 週）
