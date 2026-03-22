## Why

目前載入狀態只顯示文字「載入中...」，缺乏 shimmer skeleton 動畫，讓使用者誤以為頁面卡住。骨架屏是現代 App 的標準做法，能顯著提升感知效能。

## What Changes

- 新增 DaySkeleton 元件（模擬 day-header + weather + 3-4 個 timeline 事件的骨架）
- 替換 LOADING_VIEW 和 DaySection 的文字載入提示
- CSS shimmer 動畫

## Capabilities

### New Capabilities
- `skeleton-loading`: 骨架屏載入動畫

### Modified Capabilities
（無）

## Impact

- **新增**：`src/components/trip/DaySkeleton.tsx`
- **CSS**：`css/style.css` 新增 skeleton + shimmer 樣式
- **修改**：`src/pages/TripPage.tsx`（LOADING_VIEW + DaySection 載入態）
