## Why

行程頁每天的內容（天氣、飯店、交通、時間軸、infoBox）全部混在同一張白色卡片裡，缺乏視覺分區。特別是 infoBox 內的多筆餐廳/購物推薦彼此黏在一起，掃讀時難以快速區分。此外，`renderBudget()` 函式和相關 CSS 仍存在於 codebase 中，但所有行程 JSON 的每日 budget 資料皆為空，屬無用程式碼。

## What Changes

### 概況區色塊
- 每天頂部的天氣（`.hourly-weather`）、飯店（hotel `.col-row`）、交通統計（`.driving-stats`）合併包裹在一個 `accent-light` 底色圓角色塊中
- 時間軸維持原有 `card-bg` 無底色

### infoBox 每筆資料獨立卡片
- `.restaurant-choice`（每間餐廳/每個購物點）加上 `accent-light` 底色 + 圓角 + padding，成為獨立小卡片
- 手機版（<768px）：小卡片直排（每張佔整列寬）
- 桌機版（≥768px）：小卡片橫向 grid 排列，最多 3 欄
  - 1 張 → 1 欄整列寬
  - 偶數 → 2 欄
  - 奇數（≥3）→ 3 欄

### 移除無用 budget 程式碼
- 移除 `renderBudget()` 函式（`js/app.js`）
- 移除 `renderDayContent()` 中呼叫 `renderBudget` 的邏輯
- 移除 budget 相關 CSS（`.budget-table`、`.budget-total` 等）
- 移除相關 unit test

## Capabilities

### New Capabilities
- `day-overview-zone`: 每天概況區（天氣+飯店+交通）合併為一個 accent-light 底色塊
- `infobox-item-cards`: infoBox 內每筆資料（餐廳/購物點）獨立卡片化，含桌機版 grid 排列規則

### Modified Capabilities
（無既有 spec 需修改）

## Impact

### 檔案影響範圍
- **CSS**: `css/style.css`（新增概況區色塊樣式、`.restaurant-choice` 卡片化樣式、桌機版 grid、移除 budget 相關樣式）
- **JS**: `js/app.js`（`renderDayContent` 新增概況區 wrapper HTML、移除 `renderBudget` 函式與呼叫）
- **HTML**: 無變更
- **JSON**: 無結構變更（checklist/backup/suggestions 不受影響）
- **測試**: 更新 unit test（移除 budget 相關測試、新增卡片化樣式結構測試）
