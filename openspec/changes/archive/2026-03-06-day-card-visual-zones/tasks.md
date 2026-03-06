## 1. 概況區色塊

- [x] 1.1 在 `renderDayContent()` 中將天氣/飯店/交通統計包裹在 `<div class="day-overview">` 內
- [x] 1.2 新增 `.day-overview` CSS 樣式（`background: var(--accent-light)`、`border-radius: var(--radius-sm)`、`padding`、`margin-bottom`）
- [x] 1.3 檢查並調整概況區子元件間距（避免雙重 padding/margin）

## 2. infoBox 卡片化

- [x] 2.1 修改 `.restaurant-choice` CSS：加 `background: var(--accent-light)`、`border-radius: var(--radius-sm)`、`padding: 10px 12px`、`margin-bottom: 8px`
- [x] 2.2 在 `renderInfoBox()` 的 `restaurants` 和 `shopping` case 中，將多筆 `.restaurant-choice` 包在 `<div class="info-box-grid">` 內
- [x] 2.3 JS 依 items 數量為 `.info-box-grid` 加上 class：`grid-1`（1 張）、`grid-even`（偶數）、`grid-odd`（奇數≥3）
- [x] 2.4 新增桌機版 `.info-box-grid` CSS grid 樣式（`grid-1` → 1fr、`grid-even` → repeat(2,1fr)、`grid-odd` → repeat(3,1fr)），手機版維持直排

## 3. 移除 budget

- [x] 3.1 移除 `renderBudget()` 函式（`js/app.js`）
- [x] 3.2 移除 `renderDayContent()` 中的 `if (content.budget)` 呼叫
- [x] 3.3 移除 CSS 中 `.budget-table`、`.budget-total` 相關樣式

## 4. 測試

- [x] 4.1 移除 budget 相關 unit test（如有）
- [x] 4.2 新增 unit test：`renderDayContent` 輸出包含 `.day-overview` wrapper
- [x] 4.3 新增 unit test：`renderInfoBox` restaurants/shopping 輸出包含 `.info-box-grid`
- [x] 4.4 確認所有既有測試通過
