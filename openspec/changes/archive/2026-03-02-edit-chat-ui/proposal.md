## Why

edit.html 目前使用傳統表單式 UI（問候區 + issue 列表 + 輸入卡片），視覺上缺乏對話感，與「向 AI 提出行程修改建議」的使用情境不符。改為聊天式 UI 可讓互動流程更直覺，並在手機版與桌機版都提供更一致的體驗。

## What Changes

- 問候語區改為左對齊系統訊息卡片（帶 Spark icon）
- GitHub Issues 歷史紀錄改為右對齊氣泡，末尾附狀態標記（open 綠點 / closed 暗點）
- 輸入框固定在底部，採圓角卡片樣式
- 訊息區域可獨立捲動（flex: 1, overflow-y: auto）
- 桌機版 chat 內容區限寬 max-width: 60vw 並居中顯示
- 完全重寫 `css/edit.css` 的 layout 規則
- 修改 `js/edit.js` 的 `renderEditPage()` 與 `renderIssues()` 函式以產生新 HTML 結構

## Capabilities

### New Capabilities

- `chat-message-layout`: edit 頁聊天式訊息排版（系統訊息左對齊、使用者訊息右對齊氣泡）
- `chat-input-bar`: 底部固定輸入框（圓角卡片、sticky 定位）

### Modified Capabilities

- `edit-page`: 頁面整體 layout 由表單式改為聊天式，問候語區與 issue 列表的 HTML 結構與樣式全面更新

## Impact

- `css/edit.css`：完全重寫 layout，包含 chat container、訊息氣泡、底部 input bar
- `js/edit.js`：`renderEditPage()` 改產生 chat layout HTML；`renderIssues()` 改為氣泡渲染
- 不涉及 data 層（`data/trips/*.json`、`trips.json`）變更
- 不涉及 checklist / backup / suggestions 連動
- 不涉及 GitHub API 呼叫邏輯（僅 DOM 渲染層）
