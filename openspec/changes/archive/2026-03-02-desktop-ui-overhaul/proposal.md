# desktop-ui-overhaul

淺色模式桌機版 UI 全面優化：色彩、佈局、導覽。

## 範圍

### 色彩（僅淺色桌機）
- 頁面背景 `#FAF9F7` → `#FFFFFF`
- 卡牌/sidebar/info-panel 背景 `#FFFFFF` → `#EDE8E3`（暖灰）
- Day header 背景 → Claude 橘 `#C4704F`，文字白色
- 互動按鈕移除黑色 focus outline，改用背景色提示

### 佈局（桌機全模式）
- ≥1200px 去掉 `#tripContent` 的 `max-width: 800px`，讓 content 填滿
- `.page-layout` 加 `gap: 12px` 三欄間距
- 修復漢堡選單桌機縮小視窗時不能按的 bug

### Nav pills（全裝置）
- 動態計算可顯示天數，超過則顯示漸層遮罩
- 桌機（≥768px）加左右箭頭，到邊界隱藏箭頭但預留空間
- 手機只用漸層遮罩 + 手指滑動，不顯示箭頭

## 不做
- 深色模式不調色
- sticky-nav pills 色彩不調
- info-panel 不加新內容
