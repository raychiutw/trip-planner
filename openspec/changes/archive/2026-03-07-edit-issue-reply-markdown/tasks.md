## 1. loadIssues 查詢邏輯

- [x] 1.1 修改 `loadIssues()` API 查詢：移除 `&state=all`（API 預設含全部 state），改 `per_page=20`
- [x] 1.2 移除 `filter(issue => state==='closed' && comments > 0)` 過濾，直接將所有 Issue 傳入 `renderIssues()`

## 2. loadIssueReplies 渲染方式

- [x] 2.1 修改 `loadIssueReplies()` 中的 `ghFetch` 呼叫，傳入 `Accept: application/vnd.github.html+json` header 以取得 `body_html`
- [x] 2.2 將 `el.textContent = allReplies` 改為各自渲染 `comment.body_html`，多個 comment 以 `<hr>` 分隔，用 `innerHTML` 插入
- [x] 2.3 ghFetch 需支援自訂 headers 參數（目前 hard-coded Accept header），或在 `loadIssueReplies` 中獨立呼叫 fetch

## 3. CSS 樣式

- [x] 3.1 在 `css/edit.css` 新增 `.issue-reply` 下 markdown HTML 標籤樣式：h2/h3（`--fs-lg`）、p/table/li（`--fs-sm`）、blockquote、code、strong、hr
- [x] 3.2 table 樣式：border-collapse、th/td border 用 `var(--border)`、th 背景用 `var(--bubble-bg)`
- [x] 3.3 blockquote 樣式：左邊線 `var(--accent)`、背景 `var(--accent-lighter)`、padding
- [x] 3.4 確認深色模式下所有 markdown 標籤樣式正確顯示（使用 CSS 變數自動切換，無需額外 `body.dark` 規則）

## 4. 測試

- [x] 4.1 執行 `npm test` 確認既有測試通過
