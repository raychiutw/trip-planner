## Context

目前常用功能藏在 FAB → QuickPanel 的兩層結構中。iOS App 的 Tab Bar 是一鍵直達的標準導覽。

## Goals / Non-Goals

**Goals:**
- 固定底部 Tab Bar，3-4 個常用功能 + 「更多」
- 移除 SpeedDial FAB，改由 Tab Bar 觸發

**Non-Goals:**
- 不改 QuickPanel 內部結構
- 不改 InfoSheet 邏輯

## Decisions

### D1. Tab Bar 項目
| Tab | Icon | 功能 |
|-----|------|------|
| 行程 | map | 回到行程（當前頁面 scrollToTop） |
| 航班 | plane | 開啟 InfoSheet flights |
| 路線 | route | 開啟 TodayRouteSheet |
| 更多 | grid | 開啟 QuickPanel |

### D2. 元件架構
新增 `TabBar.tsx`，接收 `onTabSelect(tab)` callback。TripPage 根據 tab 選擇執行對應動作（開 sheet、scroll 等）。

### D3. CSS
- `position: fixed; bottom: 0; width: 100%`
- `backdrop-filter: blur(20px); background: color-mix(...)`
- `padding-bottom: env(safe-area-inset-bottom)`
- 高度 49px（Apple HIG 標準）
- 僅手機版顯示（`@media (max-width: 767px)`）

### D4. SpeedDial 處理
手機版隱藏 SpeedDial（`display: none`），桌面版保留。

## Risks / Trade-offs
- **[Risk] Tab Bar 佔用底部空間** → Mitigation：49px + safe-area，timeline content 加 bottom padding 補償
