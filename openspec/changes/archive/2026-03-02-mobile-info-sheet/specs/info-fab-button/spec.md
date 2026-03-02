## ADDED Requirements

### Requirement: 手機版 ℹ FAB 按鈕顯示
手機版（viewport 寬度 <768px）SHALL 在畫面右下角顯示 ℹ FAB 按鈕，固定位於 ＋ FAB 正上方，兩者間距 12px。桌機版（≥768px）ℹ FAB SHALL 隱藏，不佔版面空間。

#### Scenario: 手機版顯示 ℹ FAB
- **WHEN** 使用者在 <768px 寬度裝置上開啟 index.html
- **THEN** 畫面右下角顯示 ℹ FAB 按鈕（圓形，位於 ＋ FAB 正上方）

#### Scenario: 桌機版隱藏 ℹ FAB
- **WHEN** 使用者在 ≥768px 寬度裝置上開啟 index.html
- **THEN** ℹ FAB 按鈕不可見，不佔版面空間

### Requirement: ℹ FAB 按鈕使用 info icon
ℹ FAB 按鈕 SHALL 使用 `js/icons.js` ICONS registry 中的 `info` icon（Material Symbols Rounded inline SVG），不使用 emoji 或文字。

#### Scenario: ℹ FAB 顯示正確圖示
- **WHEN** ℹ FAB 按鈕渲染於頁面
- **THEN** 按鈕內顯示 Material Symbols Rounded 的 info inline SVG 圖示

### Requirement: ℹ FAB 點擊開啟 Bottom Sheet
使用者點擊 ℹ FAB 後，系統 SHALL 開啟 Bottom Sheet，並阻止事件冒泡至 backdrop。

#### Scenario: 點擊 ℹ FAB 開啟 Bottom Sheet
- **WHEN** 使用者點擊 ℹ FAB 按鈕
- **THEN** Bottom Sheet 從畫面底部滑入，backdrop 淡入

### Requirement: ℹ FAB 堆疊位置
ℹ FAB 的 `z-index` SHALL 與 ＋ FAB 相同層級（300），bottom 偏移值 SHALL 設為 88px（＝ 20px 底部邊距 + 56px FAB 高度 + 12px 間距）。

#### Scenario: ℹ FAB 不遮擋 ＋ FAB
- **WHEN** 兩個 FAB 同時顯示於畫面
- **THEN** ℹ FAB 位於 ＋ FAB 正上方，兩者不重疊，間距約 12px

### Requirement: 列印模式隱藏 ℹ FAB
列印模式（`.print-mode`）和 `@media print` 下，ℹ FAB SHALL 隱藏。

#### Scenario: 列印模式下 ℹ FAB 不顯示
- **WHEN** 使用者進入列印模式
- **THEN** ℹ FAB 按鈕不顯示（`display: none !important`）
