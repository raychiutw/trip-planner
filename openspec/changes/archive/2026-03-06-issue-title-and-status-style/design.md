## Context

Edit 頁面的 Issue 列表目前用 8px `.status-dot` 圓點區分 open/closed，辨識度低。標題含 `[trip-edit]` 前綴浪費空間。需在不新增 font-size 的前提下提升視覺辨識度。

## Goals / Non-Goals

**Goals:**
- Issue 標題移除 `[trip-edit]` 前綴，只顯示 `Owner: 修改描述`
- 用左側 3px 色條取代 status-dot，open 綠 / closed 灰
- closed issue 整列 opacity 淡化
- 不新增任何 font-size

**Non-Goals:**
- 不改 label 機制（`trip-edit` + `tripSlug` 維持不動）
- 不改 `loadIssues` 查詢邏輯（已用 tripSlug）
- 不改 `tp-issue.md` 排程邏輯

## Decisions

### 1. 色條實作方式：border-left
- `.issue-item` 加 `border-left: 3px solid transparent` 預設
- `.issue-item.open` 設 `border-left-color: var(--success)`
- `.issue-item.closed` 設 `border-left-color: var(--text-muted)` + `opacity: 0.55`
- 理由：純 CSS，不需新元素，與無框線卡片設計相容

### 2. 移除 status-dot
- `buildIssueItemHtml` 不再輸出 `<span class="status-dot">`
- 狀態 class 改放在 `.issue-item` 本身（`issue-item open` / `issue-item closed`）
- 刪除 `.status-dot` 相關 CSS

### 3. meta 行簡化
- 移除 meta 中的 `open` / `closed` 文字（色條已傳達狀態）
- 保留 `#number · date`

### 4. 標題前綴
- `submitRequest` 中 title 從 `'[trip-edit] ' + owner + ': ' + text` 改為 `owner + ': ' + text`
- 歷史 Issue 標題不回溯修改，前端顯示時不做 strip

## Risks / Trade-offs

- [已關閉 Issue 淡化] opacity 0.55 在深色模式下可能太暗 → 實測後可微調數值
- [歷史 Issue 標題] 舊 Issue 仍帶 `[trip-edit]` 前綴 → 可接受，不影響功能
