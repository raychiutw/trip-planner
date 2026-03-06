## Why

Edit 頁面的 Issue 列表辨識度不足：標題帶有冗餘的 `[trip-edit]` 前綴佔用空間，open/closed 狀態僅靠 8px 小圓點區分，不易一眼掃描。

## What Changes

- **移除 Issue 標題前綴**：建立 Issue 時 title 從 `[trip-edit] Owner: ...` 改為 `Owner: ...`，labels 維持 `["trip-edit", tripSlug]` 不變
- **狀態色條**：issue-item 左側新增 3px border-left 色條（open: `var(--success)` 綠色、closed: `var(--text-muted)` 灰色），取代原本的 status-dot 小圓點
- **已處理淡化**：closed issue 整列 `opacity: 0.55`，與 open 項目形成明顯對比
- 不新增任何 font-size，沿用既有 `--fs-sm`

## Capabilities

### New Capabilities
- `issue-status-bar`: Issue 列表左側色條狀態視覺化 + closed 淡化效果

### Modified Capabilities

（無既有 spec 需修改）

## Impact

- `js/edit.js` — `submitRequest()` 修改 title 組合邏輯；`buildIssueItemHtml()` 移除 status-dot、改用色條 class
- `css/edit.css` — 移除 `.status-dot` 相關樣式，新增 `.issue-item.open` / `.issue-item.closed` 左邊框 + opacity
- `tests/e2e/edit-page.spec.js` — 更新 Issue 相關斷言
- 不涉及 JSON 結構變更，無 checklist/backup/suggestions 連動
