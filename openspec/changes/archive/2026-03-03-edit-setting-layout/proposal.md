## Why

Edit 頁與 Setting 頁在桌機版沒有頂部留白，內容區域緊貼 viewport 頂端，視覺上壓迫感明顯。參考 Claude web app 的 Chats 頁面佈局：內容區域具備充裕的頂部留白（約 40–60px），水平置中，閱讀寬度舒適。目前兩頁均缺乏此留白設定。此外，Setting 頁的最大寬度僅 520px，在大螢幕上顯得過窄；Edit 頁的輸入卡片（`.edit-input-card`）在亮色模式下使用 `var(--card-bg)` 暖灰色背景，與 Claude 輸入框的白底風格不一致。GitHub issues 的 `per_page` 目前為 15，改為 20 可減少翻頁需求。

## What Changes

- **Setting 頁 layout**：桌機版 `.setting-page` 加入頂部留白（`padding-top: 48px`），最大寬度從 `520px` 加寬至 `640px`
- **Edit 頁 layout**：桌機版 `.chat-messages-inner` 加入頂部 padding（`padding-top: 48px`），使訊息區不緊貼頂端
- **Edit 頁輸入卡片**：亮色模式下 `.edit-input-card` 背景改為 `#FFFFFF`（純白），deep/dark 模式維持不變
- **Edit 頁 issues 數量**：`js/edit.js` 的 GitHub API 呼叫 `per_page=15` 改為 `per_page=20`

## Scope

- **CSS 檔案**：`css/setting.css`（`.setting-page` layout）、`css/edit.css`（`.chat-messages-inner` 頂部留白、`.edit-input-card` 亮色背景）
- **JS 檔案**：`js/edit.js`（`per_page` 參數）
- **HTML**：無變更
- **JSON**：無變更
- **測試**：`per_page` 值若有 unit test 引用需同步更新；CSS 為視覺調整，無需新增測試
