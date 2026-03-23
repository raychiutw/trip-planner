# Engineer G Report — SpeedDial + CSS Global

## 完成項目

### #2 FAB trigger 改回 hardcoded SVG
- `SpeedDial.tsx`: 新增 `FAB_SVG` 常數，使用 `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8l-6 6h12z" /></svg>`
- trigger button 從 `<Icon name="expand_less" />` 改為 `{FAB_SVG}`
- 不再依賴 Icon registry

### #3 出發確認補 icon
- 逐一比對 DIAL_ITEMS icon vs ICONS registry：
  - `plane` — 有
  - `checklist` — **無**（改為 `check-circle`）
  - `emergency` — 有
  - `backup` — 有
  - `lightbulb` — 有
  - `route` — 有
  - `car` — 有
  - `gear` — 有
- 僅 `checklist` 缺失，已改用 `check-circle`（圓形打勾，語意相符）

### #6 SpeedDial 重設計（4x2 雙欄垂直）
- **CSS**: `grid-template-columns: repeat(2, 1fr)` → `grid-template-rows: repeat(4, 1fr); grid-auto-flow: column`（先填滿列再換欄）
- **Item**: 移除 `flex-direction: column`，改為純 icon 按鈕，`position: relative`
- **Label**: `position: absolute; right: calc(100% + 8px)`，pill 樣式（background + border-radius: var(--radius-sm) + box-shadow: var(--shadow-md)），font-size: var(--font-size-footnote)
- **Label 固定兩字**: 航班、出發、緊急、備案、建議、路線、交通、設定
- **Staggered animation**: 反轉順序（child 8 = 0ms → child 1 = 210ms），從 FAB 附近往上展開

### #8 SpeedDial label token 確認
- `.speed-dial-label` 原使用 `var(--font-size-caption2)`，重設計後改為 `var(--font-size-footnote)`
- 已是 token，確認通過

### #15 全站 font-size token 掃描
- 搜尋 `css/*.css` 和 `src/**/*.tsx` 中所有 `font-size: Npx`
- **結果：零筆**，全站 font-size 已完成 token 化
- 標記為 no-op

### #20 InfoPanel 圓角
- `.info-panel` 加 `border-radius: var(--radius-lg)`

### #22 全站 hover 色塊 padding
已逐一評估所有 `:hover` 帶 `background` 的可點擊元素：

| 元素 | 原狀態 | 處理 |
|------|--------|------|
| `.dn` | padding: 8px 12px + radius-md | 已足夠，不動 |
| `.col-row` | padding: 12px 8px 12px 0, 無 radius | 改為 padding: var(--spacing-1) var(--spacing-2) + margin: 0 calc(-1 * var(--spacing-2)) + radius-sm |
| `.map-link` | padding: 8px 12px + radius-sm | 已足夠，不動 |
| `.quick-link-btn` | padding: 8px + radius-sm | 已足夠，不動 |
| `.today-summary-item` | padding: 8px 0 + radius-xs | 改為 padding + negative margin + radius-sm |
| `.hw-summary` | 無 background hover | 新增 background: var(--color-hover) + padding + negative margin + radius-sm |
| `.tool-action-btn` | padding: 16px 20px + radius-md | 已足夠，不動 |
| `.sheet-close-btn` | 44px 圓形 | 已足夠，不動 |
| `.download-option` | padding: 12px 8px | 已足夠，不動 |
| `.nav-back-btn` / `.nav-close-btn` | 44px 圓形 | 已足夠，不動 |
| `.trip-btn` | padding: 16px + radius-sm | 已足夠，不動 |

採用 Challenger 建議：逐一評估而非一次性全站套用，避免 negative margin 造成 flex/grid 佈局偏移。

## 測試結果

- `css-selector.test.js`: PASS (2/2)
- `css-hig.test.js`: 1 FAIL — `.countdown-number { gap: 2px }` 非本次變更（其他工程師的 countdown 重設計）

## 修改檔案

- `src/components/trip/SpeedDial.tsx` — FAB SVG + icon 修正 + label 兩字化
- `css/style.css` — SpeedDial 重設計 + InfoPanel 圓角 + hover padding
