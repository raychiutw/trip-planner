## Why

Phase 1 已完成色彩主題切換（3 套 × 淺/深），但純色背景缺乏旅遊休閒感，整體視覺偏向工具型介面而非度假氛圍。本次 Phase 2 以「沉浸式旅遊插畫背景 + 半透明卡片」提升情境感，同時整合 Speed Dial 與 Nav 的功能布局，使介面更一致、更具現代感。

## What Changes

- **新增 SVG 背景插畫系統**：6 個獨立 SVG 檔（`images/bg-{theme}-{mode}.svg`），對應 sun/sky/zen 三主題 × 淺/深兩模式，以 `background-image: url()` + `background-size: cover; background-attachment: fixed` 覆蓋整頁
- **卡片半透明化**：timeline 卡片（`#tripContent section`）、info-card 等改用 `rgba` + `backdrop-filter: blur(6px)`，讓底圖透出，增加層次感
- **Sticky nav 顯示行程名稱**：`nav-brand` 從硬編碼 "Trip Planner" 改為動態顯示 `trip.name`（行程短名稱）
- **移除 nav-actions**：Sticky nav 右側的列印與設定按鈕移除，功能整合至 Speed Dial
- **Speed Dial 全平台化 + 擴展項目**：新增 `printer`（列印模式切換）與 `settings`（導航至 setting.html）兩個 item；移除桌面版隱藏限制，讓 Speed Dial 在手機與桌面均顯示

## Capabilities

### New Capabilities

- `background-illustrations`：SVG 背景插畫系統，依主題與模式切換底圖，含 opacity 控制與 fixed 附著
- `translucent-cards`：卡片半透明化 + backdrop-filter blur，淺色與深色模式各自適用不同 rgba 值

### Modified Capabilities

- `speed-dial-universal`：Speed Dial 原為手機版專屬，現擴展為全平台顯示，並新增 printer 與 settings 兩個 item
- `sticky-nav-flush`：nav-brand 由靜態文字改為動態顯示行程名稱，nav-actions 區塊移除

## Impact

- **新增檔案**：`images/bg-sun-light.svg`、`images/bg-sun-dark.svg`、`images/bg-sky-light.svg`、`images/bg-sky-dark.svg`、`images/bg-zen-light.svg`、`images/bg-zen-dark.svg`
- **修改 CSS**：`css/shared.css`（卡片透明度規則）、`css/style.css`（Speed Dial 媒體查詢移除、背景插畫 CSS 變數引用）
- **修改 React**：`src/pages/TripPage.tsx`（nav-brand 動態化、nav-actions 移除、togglePrint/settings 移入 SpeedDial props）；`src/components/trip/SpeedDial.tsx`（新增 printer / settings item，處理導航與列印切換）
- **測試更新**：`tests/e2e/trip-page.spec.js`（驗證 nav-brand 顯示行程名稱、Speed Dial 新 item 存在）
