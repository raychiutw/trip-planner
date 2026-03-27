# Requests 分頁載入 + Message Markdown 渲染

## 背景

ManagePage 的旅伴請求列表目前一次載入全部（LIMIT 50），message 欄位以純文字顯示。
需要改為 cursor-based 分頁（每次 10 筆，infinite scroll）+ message 欄位用 marked.js 渲染 Markdown。

## 需求

### F1: Cursor-based API 分頁
- `GET /api/requests?tripId=xxx&limit=10&before=<created_at>`
- 回傳 `{ items: [...], hasMore: boolean }`
- 用 `created_at` DESC 當 cursor，避免 offset 漂移問題
- 預設 limit=10，最大 50
- 向下相容：不帶 limit/before 參數時行為不變（回傳全部，LIMIT 50）

### F2: 前端 Infinite Scroll
- ManagePage 用 IntersectionObserver 監聽底部 sentinel 元素
- 觸底時自動載入下一頁（append 到現有陣列）
- Loading 狀態顯示（底部 spinner）
- 全部載完顯示「沒有更多了」
- 切換行程時重置分頁狀態

### F3: Message Markdown 渲染
- 請求的 message 欄位用 marked.js 渲染（目前只有 reply 有 markdown）
- 使用已有的 sanitizeHtml 防 XSS
- 共用 `[data-reply-content]` 的 CSS 樣式（或改名為更通用的 `[data-md-content]`）

### F4: 飯店 details Markdown 渲染
- Hotel 元件的 details 欄位用 marked.js 渲染
- 目前 details 是字串陣列（JSON），渲染為純文字列表
- 改為支援 Markdown 格式（表格、粗體、連結等）
- 使用 sanitizeHtml 防 XSS

## Non-Goals
- 不做 pull-to-refresh（已有）
- 不做搜尋/過濾（未來需求）
- 不修改 POST /api/requests
- 不修改 PATCH /api/requests/:id

## 技術決策
- D1 SQL: `WHERE created_at < ? ORDER BY created_at DESC LIMIT ?`
- `created_at` 是 D1 auto-generated ISO timestamp，精度足夠避免重複
- marked.js 已在 ManagePage 中 import（用於 reply），不需新增依賴
