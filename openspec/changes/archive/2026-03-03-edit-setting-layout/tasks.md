## 1. Setting 頁面桌機版寬度與頂部留白

- [x] 1.1 `css/setting.css`：在 `@media (min-width: 768px)` 區塊加入 `.setting-page { max-width: 640px; padding-top: 48px; }`，覆蓋原本的 `max-width: 520px` 與無頂部留白狀態

## 2. Edit 頁面訊息區頂部留白

- [x] 2.1 `css/edit.css`：在既有 `@media (min-width: 768px)` 的 `.chat-messages-inner` 規則內加入 `padding-top: 48px`

## 3. Edit 頁面輸入卡片亮色背景

- [x] 3.1 `css/edit.css`：在 `.edit-input-card` 規則加入 `background: #FFFFFF`（覆蓋 `var(--card-bg)` 暖灰色，亮色模式生效），並確認 `body.dark .edit-input-card` 規則不受影響

## 4. GitHub issues per_page 調整

- [x] 4.1 `js/edit.js`：將 GitHub API 請求 URL 中的 `per_page=15` 改為 `per_page=20`

## 5. 驗證

- [x] 5.1 執行 `npm test` 確認所有現有測試通過
- [x] 5.2 視覺確認：亮色模式下 edit.html 輸入卡片為白底，桌機版訊息頂部有明顯留白
- [x] 5.3 視覺確認：setting.html 桌機版頁面置中且頂部有充裕留白，寬度約 640px
