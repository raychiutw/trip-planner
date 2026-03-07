## 1. 移除 info slot DOM 與渲染

- [x] 1.1 `js/app.js` `createSkeleton()`：移除 flights-slot、checklist-slot、backup-slot、emergency-slot、suggestions-slot、driving-slot（保留 footer-slot）
- [x] 1.2 `js/app.js`：刪除 `renderInfoSlot()` 函式
- [x] 1.3 `js/app.js` fetch callback：`renderInfoSlot(key, data)` 改為 `TRIP[key] = data`；移除 `renderSlotError` 呼叫改為 `console.warn`
- [x] 1.4 `js/app.js` `tryRenderDrivingStats()`：移除 DOM 寫入，改為 `TRIP.driving = { title: '全旅程交通統計', content: tripStats }`

## 2. Speed Dial 擴充

- [x] 2.1 `js/app.js` `DIAL_RENDERERS`：新增 `driving: renderTripDrivingStats`
- [x] 2.2 `index.html` Speed Dial 按鈕：新增 driving 按鈕（交通 icon + aria-label「交通統計」）
- [x] 2.3 `index.html` Speed Dial 按鈕：重新排序為 emergency → backup → checklist → driving → flights → suggestions（HTML 順序，展開後 suggestions 在最上方）

## 3. 簡化 initNavTracking

- [x] 3.1 `js/app.js` `initNavTracking()`：移除 `infoStart`、`infoRect`、`inInfo` 變數與相關邏輯，只追蹤 day headers

## 4. 清理殘留

- [x] 4.1 `js/app.js`：移除 `renderSlotError()` 函式（已無 slot 可渲染錯誤）

## 5. 測試更新

- [x] 5.1 `tests/unit/skeleton.test.js`：移除 info slot div 的斷言（flights-slot 等）
- [x] 5.2 執行 `npm test` 確認所有測試通過（pre-existing okinawa-trip-2026-HuiYun roundtrip 失敗不在本次範圍）
- [x] 5.3 E2E spec 語法檢查通過（不需實際執行 E2E）
