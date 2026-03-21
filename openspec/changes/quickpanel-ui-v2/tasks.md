## 1. QuickPanel UI 改版

- [x] 1.1 FAB 點開後隱藏（opacity:0 + pointer-events:none），關閉後恢復
- [x] 1.2 面板高度改為 85vh fallback + @supports 85dvh
- [x] 1.3 上半部 3×3 grid：列印從 section B 移到 section C，grid 改 repeat(3, 1fr)
- [x] 1.4 卡牌式樣式：background + radius-sm + shadow-md + font-size-footnote

## 2. 行程/外觀改走 InfoSheet

- [x] 2.1 QuickPanel action 從 drill-down 改為 sheet
- [x] 2.2 TripPage sheetContent 新增 trip-select / appearance case（設定頁版型）
- [x] 2.3 QuickPanel 移除 drill-down view state 和 TripSelectView/AppearanceView JSX

## 3. Focus 外框修復

- [x] 3.1 InfoSheet `.info-sheet-panel :focus:not(:focus-visible)` 隱藏程式化 focus ring
- [x] 3.2 QuickPanel `.quick-panel-sheet :focus:not(:focus-visible)` 同上

## 4. 驗證

- [x] 4.1 npx tsc --noEmit 全過
- [x] 4.2 npm test 全過
