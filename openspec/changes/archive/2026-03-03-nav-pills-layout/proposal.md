## Why

Sticky nav 日期 pills 區塊在桌機三欄佈局（≥1200px）下受限於 `max-width: 800px`，造成 nav 不能填滿全寬；pills 靠左對齊、按鈕寬度不一致（D1 vs D10）、箭頭可點擊空間過窄，導致多天行程（如 D13）右箭頭與最後一顆 pill 重疊，整體視覺與互動品質不符預期。

## What Changes

- **sticky-nav 桌機全寬**：在 `@media (min-width: 1200px)` 下覆蓋 `.sticky-nav { max-width: none; }`，使 nav 欄在三欄佈局中填滿 content 寬度
- **Pills 置中對齊**：`.dh-nav` 的 `justify-content` 從 `flex-start` 改為 `center`，讓所有日期 pills 在 nav 列中央排列
- **按鈕等寬**：`.dn` 加入 `min-width` 與 `text-align: center`，確保 D1～D10（含以上）按鈕寬度一致
- **箭頭獨立空間**：`.dh-nav-arrow` 的 `padding` 從 `0 4px` 增加至 `0 8px`，或補 `min-width: 28px`，確保箭頭有足夠可點擊區域，不與 pills 重疊

## Scope

**包含：**
- `css/style.css` 中 sticky-nav、dh-nav、dn、dh-nav-arrow 四處 CSS 修正
- 涵蓋所有裝置寬度（手機 / 桌機 768px+ / 三欄 1200px+）

**不包含：**
- JS 邏輯變更（`initNavOverflow`、`updateNavArrows` 不動）
- HTML 結構變更
- 任何 JSON 資料變更
- 深色模式 / 亮色模式色彩調整
