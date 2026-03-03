## Approach

本次變更採「最小修改原則」——不調整整體佈局結構，只透過新增 CSS 覆蓋規則達成視覺調整。所有桌機版樣式收納於既有的 `@media (min-width: 768px)` 區塊內，行動版不受影響。

### Setting 頁面寬度與頂部留白

目前 `.setting-page` 為 `max-width: 520px; margin: 0 auto; padding: 16px`，在桌機版顯得過窄且頂部緊貼。

決策：
- `max-width` 從 `520px` 改為 `640px`，提供更舒適的閱讀寬度，同時避免在 1440px 以上螢幕過度拉寬
- 加入 `padding-top: 48px`（僅桌機版），對應 Claude 約 40–60px 頂部留白的視覺標準
- 行動版 padding 維持 `16px` 不變，避免行動端留白過多

### Edit 頁訊息區頂部留白

目前 `.chat-messages-inner` 在桌機版僅設定 `max-width: 60vw; margin: 0 auto`，無頂部留白。

決策：
- 在 `@media (min-width: 768px)` 區塊的 `.chat-messages-inner` 加入 `padding-top: 48px`
- 留白直接作用於訊息內容區域（而非外層 `.chat-messages`），保留 scroll padding 語意的清晰度

### Edit 頁輸入卡片亮色背景

目前 `.edit-input-card { background: var(--card-bg) }` 在亮色模式為暖灰 `#EDE8E3`，與 Claude 白色輸入框視覺差異大。

決策：
- 亮色模式下覆蓋為 `background: #FFFFFF`（明確白色，不用 `var(--white)` 是因為 `--white` 在 dark mode 值為 `#292624`，會造成 dark override 失效）
- `body.dark .edit-input-card` 維持既有 dark mode 規則不變

### GitHub issues per_page

`per_page=15` 改為 `per_page=20`，直接修改 `js/edit.js` 第 91 行的 URL 字串，影響範圍僅此一處。對應 spec 中 `--per_page 20` 的描述需同步更新。

## Files Changed

| 檔案 | 變更 |
|------|------|
| `css/setting.css` | `.setting-page` 加 `@media (min-width: 768px)` 覆蓋：`max-width: 640px; padding-top: 48px` |
| `css/edit.css` | `.chat-messages-inner` 的 `@media` 區塊加 `padding-top: 48px`；`.edit-input-card` 加亮色 `background: #FFFFFF` 覆蓋 |
| `js/edit.js` | `per_page=15` 改為 `per_page=20` |
