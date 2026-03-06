## Context

Edit 頁的 issue 列表（`js/edit.js` 的 `buildIssueItemHtml()`）目前以左邊框顏色區分 open/closed，closed 再加 `opacity: 0.55`。處理完的 issue 會由 `/tp-issue` 留一則 comment（`✅ 已處理：{摘要}` 或 `❌ 處理失敗：{錯誤}`）後 close。目前列表不顯示 comment 內容。

現有 icon registry（`js/icons.js`）已有 `check-circle`，缺 `circle-dot`（open 狀態用）。

## Goals / Non-Goals

**Goals:**
- 用 GitHub-style pill badge 明確標示 issue 的 open/closed 狀態
- 讓使用者在列表中直接看到 closed issue 的處理回覆
- 桌機版 issue 標題字級提升至 `--fs-md` 增加可讀性

**Non-Goals:**
- 不做 comment 的 markdown 解析或富文本渲染
- 不做 open issue 的 comment 顯示
- 不修改 issue 的建立/送出流程
- 不新增色彩 CSS 變數（badge 顏色硬編碼於 CSS class）

## Decisions

### D1: Badge 實作方式

在 `buildIssueItemHtml()` 中，於 title `<a>` 前插入 badge `<span>`：
```html
<span class="issue-badge open">
  <svg ...><!-- circle-dot --></svg>Open
</span>
```

Badge 顏色直接寫在 `.issue-badge.open` / `.issue-badge.closed` CSS class 中（`background: #238636` / `#8957e5`），不新增 CSS 變數。

**理由**：badge 顏色為 GitHub 品牌色，不屬於本站色彩系統，hardcode 最直觀。

### D2: circle-dot icon

在 `js/icons.js` 的 `ICONS` 物件中新增 `circle-dot` icon（Material Symbols 的 `radio_button_checked` 或自繪簡單的外圓+內圓 SVG）。

**理由**：全站統一走 `ICONS` registry + `iconSpan()` helper。

### D3: Comment 非同步載入策略

在 `renderIssues()` 完成後：
1. 收集所有 `state === 'closed' && comments > 0` 的 issue
2. 對每個 issue 並行呼叫 `GET /repos/{owner}/{repo}/issues/{number}/comments`
3. 每個 response 回來後，取最後一則 comment 的 `body`，以 `textContent` 寫入對應的 `#reply-{number}` DOM 元素
4. fetch 失敗則顯示「無法載入回覆」

**理由**：並行 fetch 最快完成，且每個 issue 獨立更新不互相阻塞。per_page=20 最多 20 個 closed issue 需要 fetch，在合理範圍內。

### D4: Reply placeholder

在 `buildIssueItemHtml()` 中，當 `issue.state === 'closed' && issue.comments > 0` 時，在 meta 下方插入：
```html
<div class="issue-reply" id="reply-42">讀取回覆中…</div>
```

**理由**：先渲染 placeholder 再非同步替換，使用者立刻看到結構，不用等 comment API。

### D5: 桌機版 title 字級

用 `@media (min-width: 768px)` 將 `.issue-item-title` 的 `font-size` 從 `var(--fs-sm)` 改為 `var(--fs-md)`。

**理由**：桌機版寬度足夠，放大一級提升可讀性。

### D6: 移除舊狀態指示

- 移除 `.issue-item.open` 的 `border-left-color: var(--success)`
- 移除 `.issue-item.closed` 的 `border-left-color: var(--text-muted)` 和 `opacity: 0.55`
- 移除 `.issue-item` 的 `border-left: 3px solid transparent`

**理由**：badge 已取代左邊框的狀態指示功能，opacity 降低也不再需要。

## Risks / Trade-offs

- **[GitHub API Rate Limit]** → 未認證每小時 60 次，已認證 5000 次。目前用 PAT 呼叫，20 個 issue 的 comment 最多加 20 次，不會超限。
- **[Comment 為空或被刪除]** → `comments > 0` 但實際 comment 列表為空（極端情況）→ 顯示空白或「無法載入回覆」，不影響功能。
- **[Badge 顏色與深色模式]** → `#238636`（綠）和 `#8957e5`（紫）在深色背景上對比度仍足夠，無需深色模式特殊處理。
