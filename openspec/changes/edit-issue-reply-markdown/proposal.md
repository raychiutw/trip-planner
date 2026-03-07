## Why

edit.html 的 Issue 回覆區目前用 `el.textContent` 顯示原始 markdown 文字，表格、標題、粗體等格式全部糊成純文字，使用者體驗差。同時 `loadIssues()` 只顯示已關閉且有回覆的 Issue，使用者送出請求後看不到自己的 open Issue。

## What Changes

- **loadIssues() 查詢邏輯**：移除 `state==='closed' && comments > 0` 過濾，改為只用 `labels={tripSlug}` 查詢最新 20 筆 Issue（不限 state），全部顯示
- **loadIssueReplies() 渲染方式**：從 `textContent`（純文字）改為使用 GitHub API `body_html` 欄位，以 `innerHTML` 渲染 markdown HTML
- **edit.css 樣式**：在 `.issue-reply` 下新增 markdown HTML 標籤（h2/h3、table、blockquote、code、strong、ul/ol）的樣式，使用既有 CSS 變數，自動支援深淺色模式

## Capabilities

### New Capabilities
- `issue-reply-render`: 將 Issue 回覆從純文字改為 GitHub 渲染的 markdown HTML 顯示，並調整查詢邏輯顯示所有 Issue

### Modified Capabilities

（無既有 spec 需修改）

## Impact

- `js/edit.js`：修改 `loadIssues()`、`loadIssueReplies()` 函式
- `css/edit.css`：新增 `.issue-reply` 下的 markdown 標籤樣式
- 無 JSON 結構變更，不影響 checklist/backup/suggestions
- 無新依賴（不引入第三方 markdown 解析庫）
