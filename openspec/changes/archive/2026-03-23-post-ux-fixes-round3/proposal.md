# UX 修復第三輪 — 提案

## 背景

Round 2 deploy 後 Key User 實際操作發現 13 項問題。其中 SpeedDial 左欄 icon 被右欄 label 遮擋是 🔴 嚴重問題（QC v2 用截圖確認根因）。

## 13 項修復清單

### SpeedDial 修復（🔴）
- R3-10: SpeedDial 維持 4×2 雙欄，grid 向左擴展空間解決 label 遮擋
- R3-11: SpeedDial label 改回舊版 pill 樣式（背景+圓角+shadow）

### UI 移除/簡化
- R3-2: 設定頁 ← 返回箭頭移除
- R3-3: DayNav active label 移除（.dn-active-label 拿掉）
- R3-4: InfoPanel 倒數天數移除（Countdown 元件拿掉）
- R3-5: InfoPanel 車程統計移除（TripStatsCard 拿掉）

### Bottom Sheet
- R3-1: X 關閉按鈕統一放大（與設定頁一致）

### InfoPanel 桌面版改善
- R3-6: InfoPanel 寬度加大
- R3-7: 今日行程加入地圖連結 + map code
- R3-8: 今日行程加入飯店資訊 + 當日交通摘要
- R3-9: hover padding 加大（spacing-1/2 → spacing-2/3）

### 流程改善
- R3-12: QC 標準加強：截圖視覺驗證必須與 DOM 檢查並行，不能只靠 DOM
