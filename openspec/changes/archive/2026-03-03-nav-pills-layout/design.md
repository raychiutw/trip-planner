## Approach

本次變更為純 CSS 補丁，全部集中於 `css/style.css`，不涉及 JS、HTML 或資料層。四項修正均針對既有選擇器的媒體查詢或屬性值進行覆蓋，無需新增 class 或修改 HTML 結構。

### Item 1：sticky-nav 桌機全寬

現行 `@media (min-width: 768px)` 設定 `.sticky-nav { max-width: var(--content-max-w); margin: 0 auto; }`（800px 上限），但 `≥1200px` 三欄佈局下 `#tripContent` 已設定 `max-width: none`，兩者不一致造成 nav 欄比 content 窄。

**解法**：在現有 `@media (min-width: 1200px)` 區塊中補加 `.sticky-nav { max-width: none; }`，與 `#tripContent` 行為一致。

### Item 2：Pills 置中對齊

`.dh-nav` 目前有兩處 `justify-content: flex-start`——一是選擇器本身（line 41），一是 `@media (min-width: 768px)` 媒體查詢（line 82）。兩處均改為 `justify-content: center`，使 pills 在有剩餘空間時置中顯示；溢出時仍由 `overflow-x: auto` 處理捲動，行為不受影響。

### Item 3：按鈕等寬

`.dn` 目前使用 `padding: 6px 12px` 決定按鈕寬度，單字元（D1）與雙字元（D10）按鈕外觀不一。

**解法**：加入 `min-width: 40px; text-align: center;`，確保任何天數標籤都有統一的最小寬度，同時 `padding` 保留提供兩側視覺呼吸空間。

### Item 4：箭頭獨立空間

`.dh-nav-arrow` 目前 `padding: 0 4px`（共 8px 橫向空間）過窄，天數多時右箭頭與最後一顆 pill 視覺重疊。

**解法**：`padding` 改為 `0 8px`，並補加 `min-width: 28px`，保證在任何 pill 數量下箭頭都有充足的可點擊區域。

## Files Changed

| 檔案 | 變更說明 |
|------|---------|
| `css/style.css` | **Line ~34**：`@media (min-width: 768px)` 的 `.sticky-nav` 保持不動（768px 仍需置中限寬） |
| `css/style.css` | **Line ~289 三欄媒體查詢**：補加 `.sticky-nav { max-width: none; }` |
| `css/style.css` | **Line ~41**：`.dh-nav` 加 `justify-content: center` |
| `css/style.css` | **Line ~43**：`.dn` 加 `min-width: 40px; text-align: center;` |
| `css/style.css` | **Line ~65 區塊**：`.dh-nav-arrow` 加 `min-width: 28px;`，`padding` 改為 `0 8px` |
| `css/style.css` | **Line ~82 媒體查詢**：`@media (min-width: 768px)` 內的 `.dh-nav` `justify-content` 改為 `center` |
