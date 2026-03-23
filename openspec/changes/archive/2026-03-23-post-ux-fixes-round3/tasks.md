# UX 修復第三輪 — 任務清單

## SpeedDial 修復
- [x] R3-10.1 .speed-dial-items grid 向左擴展：加大 grid 容器寬度或加 left padding，讓左欄 label 有空間
- [x] R3-10.2 確認右欄 label 不再覆蓋左欄 icon（截圖驗證）
- [x] R3-11 SpeedDial label 改回 pill 樣式（background + border-radius + box-shadow）

## UI 移除/簡化
- [x] R3-2 設定頁：找到 ← 返回箭頭並移除（若 Reviewer 確認不存在則 no-op）
- [x] R3-3 DayNav：移除 .dn-active-label 的 JSX + CSS
- [x] R3-4 InfoPanel：移除 Countdown 元件的 import + 渲染
- [x] R3-5 InfoPanel：移除 TripStatsCard / DrivingStats 元件的 import + 渲染 + 清理 CSS

## Bottom Sheet
- [x] R3-1 .sheet-close-btn 尺寸統一（確認所有頁面都是 44px var(--tap-min)）

## InfoPanel 桌面版改善
- [x] R3-6 .info-panel 寬度加大（從目前寬度 +60~80px）
- [x] R3-7 TodaySummary 每項加地圖連結（Google Maps icon + Naver Map icon）
- [x] R3-8 InfoPanel 加飯店資訊卡 + 當日交通摘要卡
- [x] R3-9 全站 hover padding 加大：var(--spacing-1/2) → var(--spacing-2/3)

## 流程改善
- [x] R3-12 QC prompt 加強：「截圖視覺驗證優先，DOM 檢查輔助。不能只靠 DOM 判 PASS」
