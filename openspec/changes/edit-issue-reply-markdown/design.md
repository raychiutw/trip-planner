## Context

edit.html 的 Issue 列表由 `js/edit.js` 中三個函式組成：
- `loadIssues()`：向 GitHub API 查詢 Issue 並過濾
- `renderIssues()`：建立 Issue 卡片 HTML
- `loadIssueReplies()`：非同步載入每個 Issue 的 comment 並顯示

目前 `loadIssues()` 只顯示 `state==='closed' && comments > 0` 的 Issue，回覆用 `el.textContent` 塞入原始 markdown 文字。

## Goals / Non-Goals

**Goals:**
- Issue 列表顯示所有狀態（open + closed），最新 20 筆
- Issue 回覆以 GitHub 渲染的 HTML 顯示，支援表格、標題、粗體等格式
- markdown HTML 在深淺色模式下正確顯示

**Non-Goals:**
- 不引入第三方 markdown 解析庫（marked.js 等）
- 不改變 Issue 送出邏輯（`submitRequest()`）
- 不改變 Issue 卡片的整體佈局結構

## Decisions

### D1: 使用 GitHub API `body_html` 而非前端 markdown 解析

**選擇**：請求 GitHub API comments 時加入 `Accept: application/vnd.github.html+json` header，使回傳的 comment 物件包含 `body_html` 欄位

**替代方案**：
- marked.js CDN：多一個外部依賴，需處理 XSS sanitize
- 自製簡易解析：功能有限，維護成本高
- `white-space: pre-wrap`：保留換行但不解析格式

**理由**：零依賴、GitHub 原生渲染品質、已經過 sanitize

### D2: CSS 用既有 CSS 變數處理深淺色

在 `.issue-reply` 下為 `h2`、`h3`、`table`、`th`、`td`、`blockquote`、`code`、`strong`、`ul`、`ol` 設定樣式，全部使用 `var(--text)`、`var(--border)`、`var(--bubble-bg)` 等既有變數。`body.dark` 覆寫變數時自動切換。

### D3: ghFetch 不修改全域 Accept header

`loadIssueReplies` 呼叫 comments API 時，獨立傳入 `Accept: application/vnd.github.html+json`，不影響其他 `ghFetch` 呼叫（建立 Issue、查詢 Issue 列表等仍用 `application/vnd.github+json`）。

## Risks / Trade-offs

- **[XSS 風險]** `innerHTML` 插入外部 HTML → GitHub API 回傳的 `body_html` 已經過 sanitize，且 comment 只有 repo owner（bot）能寫入，風險極低
- **[API 相容性]** `body_html` 欄位需 `Accept` header → GitHub REST API v3 穩定支援，不會變動
- **[多 comment 合併]** 目前用 `join('\n\n')` 合併多個 comment body → 改為各自渲染 `body_html` 並以分隔線區隔
