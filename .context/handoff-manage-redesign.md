# ManagePage Chat Redesign — Handoff

## Branch
`feature/manage-chat-redesign` (已建，基於 master fa212e2)

## Pipeline 進度
- ✅ Think — /design-shotgun 完成，4 方案 + 3 種 threading + 3 種 input
- ✅ Plan — spec 確定（見下方），plan file 在 docs/superpowers/plans/
- ⬜ Build — 重寫 ManagePage.tsx
- ⬜ /simplify → /tp-code-verify → /review → /cso --diff → /ship → /land-and-deploy → /retro → archive

## 設計 Spec（全部已確認）

### 版面：iMessage Chat Bubbles
- 用戶請求：**右側 coral 氣泡**（`bg-accent text-accent-foreground`，`border-bottom-right-radius: 4px`）
- AI 回覆：**左側 sand 氣泡**（`bg-secondary text-foreground`，`border-bottom-left-radius: 4px`）
- AI 回覆上方有 **Tripline avatar + 名字**

### 回覆對應：Quote Reply（Telegram 風格）
- AI 氣泡內上方有引用條：`border-left: 3px solid accent` + 原始訊息摘要
- 引用條背景：`rgba(0,0,0,0.06)`

### Status Badge
- 在用戶氣泡下方顯示小 badge
- 已完成：`bg-[#D4EDDA] text-[#155724]`
- 處理中：`bg-plan-bg text-plan-text`
- 等待中：`bg-[#FFF3CD] text-[#856404]`

### Toggle：獨立浮動 Pill（風格 3）
- 在輸入框上方，獨立的 pill buttons
- 修改：active = `border-accent bg-accent-bg text-accent`
- 提問：active = `border-plan-text bg-plan-bg text-plan-text`

### 輸入框
- pill 形狀（`rounded-full`）
- 1 行起始，最多 5 行向上撐高
- `max-height: calc(1.5em * 5 + padding)`
- `overflow-y: auto` 超過 5 行後
- 無 quick reply chips
- Enter 送出，Shift+Enter 換行
- 送出按鈕：coral 圓形，disabled 時灰色

### 排序
- API 回傳 newest first（現有行為）
- 前端 `.reverse()` 後顯示（oldest at top, newest at bottom）
- 開啟頁面 `scrollTo bottom`
- 往上捲看舊訊息
- Infinite scroll sentinel 改到頂部（載入更多舊的）

### 桌機版
- 左 sidebar 320px：行程列表（avatar + name + preview + timestamp + unread badge）
- 右 chat 區：flex-1，max-width 720px centered
- `@media (max-width: 768px)` 隱藏 sidebar

### Nav
- Caveat italic "Tripline" logo（coral）
- Trip selector pill（center）
- Close X button（right）
- Glassmorphism backdrop-blur

## 現有 Code 結構（ManagePage.tsx 553 行）
- L1-14: imports
- L16-36: types（RawRequest, MyTrip, TripInfo）— **保留**
- L38-58: SCOPED_STYLES — **移除，改 Tailwind**
- L60-63: SELECT_CHEVRON + styles — **保留**
- L65-70: renderMarkdown — **保留**
- L72-80: formatDate — **保留**
- L82-122: RequestItem memo — **重寫為 ChatBubble**
- L124-129: PageState type — **保留**
- L131-358: ManagePage hooks/effects — **保留邏輯，改 render**
- L380-553: Render JSX — **完全重寫**

## 改動摘要
1. 刪除 SCOPED_STYLES，改成 `[data-reply-content]` 的 Tailwind prose
2. RequestItem → ChatBubble（user bubble + AI quote reply）
3. 新增 TripSidebar 元件（桌機版）
4. Input bar 重寫：floating toggle pills + auto-grow textarea
5. Messages 區域：flex-col-reverse 或 reverse() + scrollToBottom
6. IntersectionObserver sentinel 移到頂部

## Design Demo 檔案
`~/.gstack/projects/raychiutw-trip-planner/designs/manage-redesign-20260330/`
- variant-A/B/C/D.png — 4 個方案 mockup
- variant-C-desktop-demo.html — 桌機版互動 demo
- reply-threading-demo.html — 3 種 threading 方式
- reply-threading-desktop-demo.html — 桌機版 threading（3 tab 切換）
- input-spec-demo.html — 3 種 input toggle 位置
- design-board.html — 比較頁面

## 下個 Session 指令
```
git checkout feature/manage-chat-redesign
# 讀 .context/handoff-manage-redesign.md 和 memory
# 繼續 Build 階段：重寫 ManagePage.tsx
```
