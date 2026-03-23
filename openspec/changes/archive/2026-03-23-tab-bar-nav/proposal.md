## Why

QuickPanel 的 FAB 按鈕需要兩次點擊才能到達常用功能（航班、路線等），不符合 iOS Tab Bar 的一鍵直達慣例。底部 Tab Bar 是行動 App 最基本的導覽模式。

## What Changes

- 新增固定底部 Tab Bar 元件，顯示 3-4 個最常用功能 + 「更多」
- Tab Bar 使用 backdrop-filter blur + safe-area padding
- 移除或隱藏 FAB 按鈕（SpeedDial），改由 Tab Bar 觸發 QuickPanel
- QuickPanel 改為「更多」Tab 的子選單

## Capabilities

### New Capabilities
- `tab-bar`: 固定底部 Tab Bar 導覽

### Modified Capabilities
（無）

## Impact

- **新增**：`src/components/trip/TabBar.tsx`
- **CSS**：`css/style.css` 新增 tab-bar 樣式
- **修改**：`src/pages/TripPage.tsx`（加入 TabBar、移除/隱藏 SpeedDial）
- **修改**：`src/components/trip/QuickPanel.tsx`（由 TabBar 觸發）
