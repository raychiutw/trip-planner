## 1. CSS Changes

- [x] 1.1 `css/style.css`：在 `@media (min-width: 1200px)` 區塊中補加 `.sticky-nav { max-width: none; }`，使三欄佈局下 sticky-nav 填滿 content 全寬
- [x] 1.2 `css/style.css`：`.dh-nav` 選擇器的 `justify-content` 從 `flex-start` 改為 `center`
- [x] 1.3 `css/style.css`：`@media (min-width: 768px)` 區塊中 `.dh-nav` 的 `justify-content` 從 `flex-start` 改為 `center`（與 1.2 同步，確保桌機覆蓋規則一致）
- [x] 1.4 `css/style.css`：`.dn` 選擇器加入 `min-width: 40px; text-align: center;`
- [x] 1.5 `css/style.css`：`.dh-nav-arrow` 選擇器的 `padding` 從 `0 4px` 改為 `0 8px`，並加入 `min-width: 28px;`

## 2. 驗證

- [x] 2.1 執行 `npm test` 確認所有現有測試通過（純 CSS 變更，無 JS 邏輯異動，預期測試無須修改）
- [x] 2.2 手動檢查：桌機 ≥1200px 視窗，確認 sticky-nav 全寬填滿，pills 置中，D1/D10 等寬，箭頭不與 pill 重疊
- [x] 2.3 手動檢查：桌機 768px～1199px，確認 sticky-nav 仍有 max-width 限制並置中
- [x] 2.4 手動檢查：多天行程（≥13 天）右箭頭與最後一顆 pill 有足夠間距
