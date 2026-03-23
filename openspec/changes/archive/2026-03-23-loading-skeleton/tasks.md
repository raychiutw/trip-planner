## 1. DaySkeleton 元件

- [x] 1.1 新增 `src/components/trip/DaySkeleton.tsx`：模擬 day-header + weather bar + 3 個 timeline 事件的骨架
- [x] 1.2 在 `css/style.css` 新增 `@keyframes shimmer` 動畫 + `.skeleton-bone` 樣式

## 2. 整合到 TripPage

- [x] 2.1 修改 `src/pages/TripPage.tsx`：LOADING_VIEW 改為顯示 2-3 個 DaySkeleton
- [x] 2.2 修改 DaySection：slot-loading 狀態改為顯示 DaySkeleton
- [x] 2.3 骨架 → 真實內容的 fade-in 過渡效果

## 3. 測試

- [x] 3.1 執行 `npx tsc --noEmit` + `npm test` 確認全過
