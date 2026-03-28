# Session 交班文件

## 分支
`feat/requests-pagination-markdown`

## 下一步
從 `/autoplan` 開始跑完整 tp-team pipeline（Think 已跳過，需求明確）

## Proposal 位置
`openspec/changes/requests-pagination-markdown/proposal.md`

## 4 個功能需求

### F1: Cursor-based API 分頁
- `GET /api/requests?tripId=xxx&limit=10&before=<created_at>`
- 回傳 `{ items: [...], hasMore: boolean }`
- D1 SQL: `WHERE created_at < ? ORDER BY created_at DESC LIMIT ?`
- 預設 limit=10，最大 50，向下相容

### F2: 前端 Infinite Scroll
- ManagePage 用 IntersectionObserver 監聽底部 sentinel
- 觸底自動載入下一頁（append 不替換）
- Loading spinner + 「沒有更多了」狀態
- 切換行程時重置

### F3: Request message Markdown 渲染
- message 欄位用 marked.js 渲染（目前只有 reply 有 markdown）
- sanitizeHtml 防 XSS
- 共用 `[data-reply-content]` CSS 樣式（或改名 `[data-md-content]`）

### F4: 飯店 details Markdown 渲染
- Hotel 元件的 details 欄位用 marked.js 渲染
- sanitizeHtml 防 XSS

## 關鍵檔案
- API: `functions/api/requests.ts`（目前 LIMIT 50，無分頁參數）
- 前端: `src/pages/ManagePage.tsx`（loadRequests 一次拉全部）
- 飯店: `src/components/trip/Hotel.tsx`
- marked.js 已在 ManagePage import（用於 reply）
- sanitizeHtml: `src/lib/sanitize.ts`

## 技術決策（已確認）
- 用 cursor-based（非 offset）避免漂移
- `created_at` 當 cursor（D1 auto-generated ISO timestamp）
- marked.js 已有，不需新增依賴

## Pipeline 進度
```
❌ Think   — 跳過（需求明確）
❌ Plan    — /autoplan 待跑
❌ Build
❌ Review
❌ Test
❌ Ship
❌ Land
❌ Reflect
```

## 指令
```
在 feat/requests-pagination-markdown 分支，讀 openspec/changes/requests-pagination-markdown/proposal.md 和 handoff.md，跑 /autoplan 然後完整 tp-team pipeline
```
