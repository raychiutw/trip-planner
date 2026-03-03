## Why

edit.html 的 issue 歷史以右對齊氣泡呈現，視覺上像「使用者自己傳的訊息」，不符合閱讀清單的直覺。標題列在桌機版完全隱藏，使用者無法得知目前正在編輯哪個行程。需要改為左對齊列表式（類似 Slack thread）並加上置頂標題列。

## What Changes

- **Issue 列表改為左對齊列表式**：移除右對齊氣泡佈局，改用左對齊列表項目搭配虛線分隔，每項顯示 status dot（● open / ○ closed）、標題連結、issue 編號、時間與狀態文字
- **新增置頂標題列**：顯示「編輯行程 · {行程名稱}」，手機版含漢堡按鈕，桌機版隱藏漢堡按鈕（因有 sidebar）
- **Textarea 自動伸縮**：輸入框隨內容行數自動長高（到上限後 scroll）
- **Enter 鍵送出**：Enter 送出、Shift+Enter 換行
- **深色 disabled 按鈕色碼修正**：`body.dark .edit-send-btn:disabled` 硬寫 hex 改用 CSS 變數
- **問候語空頁面垂直置中**：無 issue 時問候語在可視區域垂直居中
- **送出後樂觀插入列表**：新 issue 立即出現在列表中，不等 API 重新拉取

## Capabilities

### New Capabilities
- `edit-title-bar`: 編輯頁面置頂標題列，顯示行程名稱，手機/桌機自適應

### Modified Capabilities
- `edit-page`: Issue 歷史紀錄從右對齊氣泡改為左對齊列表式呈現；問候語空頁面垂直置中；送出後樂觀插入
- `chat-message-layout`: 移除使用者訊息右對齊氣泡規範，改為左對齊列表項目
- `chat-input-bar`: textarea 自動伸縮、Enter 鍵送出、深色 disabled 按鈕色碼修正

## Impact

- **css/edit.css**：移除 `.message-user` 右對齊氣泡樣式，新增列表式 issue 項目樣式；修改 `.sticky-nav` 桌機版行為（從隱藏改為顯示但無漢堡按鈕）
- **js/edit.js**：`renderIssues()` 產出的 HTML 結構改為列表式；`renderEditPage()` 標題列加入行程名稱；textarea auto-resize + Enter 鍵送出；送出後樂觀插入
- **edit.html**：sticky-nav 內加入標題文字容器
