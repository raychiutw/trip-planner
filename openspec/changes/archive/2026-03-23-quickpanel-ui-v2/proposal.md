## Why

fab-bottom-panel 上線後，Key User 反饋 QuickPanel 的 UI 需要調整：FAB 開啟後不應繼續顯示、面板高度不夠、grid 排版太密、行程/外觀 drill-down 應用 InfoSheet 標準版型、InfoSheet 有 focus 外框問題。

## What Changes

- FAB 點開後隱藏（非旋轉），關閉後恢復
- 面板高度從 50vh 改為 85vh（同 InfoSheet）
- 上半部從 4 欄改為 3×3 卡牌式 grid（9 項），列印移到下載區
- 卡牌樣式：背景 + 圓角 + 陰影，字級 `--font-size-footnote`
- 「行程」「外觀」從 QuickPanel drill-down 改為開啟 InfoSheet（設定頁版型）
- QuickPanel 簡化為純 grid 選單（移除 drill-down view state）
- InfoSheet + QuickPanel 內 focus 外框修復（`:focus:not(:focus-visible)` 隱藏程式化 focus ring）

## Capabilities

### Modified Capabilities

- `quick-panel`: grid 排版改為 3×3 卡牌 + FAB 隱藏 + 行程/外觀移至 InfoSheet

## Impact

- `src/components/trip/QuickPanel.tsx` — 簡化為純 grid，移除 drill-down
- `src/pages/TripPage.tsx` — 新增 trip-select / appearance sheet content
- `css/style.css` — 3×3 grid + 卡牌樣式 + FAB 隱藏 + focus 修復
