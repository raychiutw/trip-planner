## Why

行程主頁目前將航班、checklist、備案、緊急聯絡、建議事項、交通統計等輔助內容直接渲染到 DOM（info slots），同時又透過 Speed Dial → Bottom Sheet 提供相同內容的存取。這造成頁面冗長、DOM 重複、桌機手機體驗不一致。統一改為僅由 Speed Dial → Bottom Sheet 存取，主頁面只保留每日行程與 Footer。

## What Changes

- **移除 info slot DOM 元素**：`createSkeleton()` 不再產生 `flights-slot`、`checklist-slot`、`backup-slot`、`emergency-slot`、`suggestions-slot`、`driving-slot`（保留 `footer-slot`）
- **刪除 `renderInfoSlot()` 函式**：不再將輔助內容渲染到主頁面 DOM
- **Fetch callback 改為 cache-only**：`fetch` 取得資料後只做 `TRIP[key] = data`，不呼叫 `renderInfoSlot`
- **`tryRenderDrivingStats()` 改為 cache-only**：計算後存入 `TRIP.driving`，不寫入 DOM
- **新增 driving 到 Speed Dial**：`DIAL_RENDERERS` 加入 `driving: renderTripDrivingStats`，HTML 加入 driving 按鈕
- **重新排序 Speed Dial 按鈕**：suggestions 移到最上方（離 trigger 最遠），順序為 suggestions → flights → driving → checklist → backup → emergency
- **移除 `initNavTracking()` 的 info section 依賴**：不再用 `sec-flight` 判斷是否進入 info 區域
- **更新測試**：`skeleton.test.js` 移除 info slot div 的斷言

## Capabilities

### New Capabilities

（無新增）

### Modified Capabilities

- `info-bottom-sheet`：Bottom Sheet 新增 driving 內容支援，成為所有輔助內容的唯一存取入口
- `info-fab-button`：Speed Dial 按鈕新增 driving、重新排序（suggestions 最上方）

## Impact

- **js/app.js**：`createSkeleton()`、`renderInfoSlot()`（刪除）、fetch callback、`tryRenderDrivingStats()`、`DIAL_RENDERERS`、`initNavTracking()`
- **index.html**：Speed Dial 按鈕區塊（新增 driving 按鈕、重新排序）
- **tests/unit/skeleton.test.js**：移除 info slot 相關斷言
- 不涉及 CSS 變更（slot 移除後 CSS 規則自然不匹配，無副作用）
- 不涉及 data/trips-md/ 或 JSON 結構變更
