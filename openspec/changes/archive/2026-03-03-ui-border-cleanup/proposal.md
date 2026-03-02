## Why

設定頁行程選擇的 `.active` 外框使用 `box-shadow: 0 0 0 2px` 模擬邊框，在部分裝置/縮放比例下渲染不均勻（四邊粗細不一致）。同時，edit.html 頂部 sticky-nav 在 dark mode 下因背景色差（`--white: #292624` vs `--bg: #1A1A1A`）形成一條明顯的淺色橫條，需移除。

## What Changes

- 將 `.trip-btn.active` 的 `box-shadow` 邊框改為真正的 CSS `border`，確保四邊等粗
- 預設狀態加 `border: 2px solid transparent` 佔位，避免 active 切換時版面跳動
- edit.html 的 `.sticky-nav` 背景改為透明，消除頂部色條

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `setting-page`：`.trip-btn.active` 外框從 `box-shadow` 改為 `border`

## Impact

- **CSS 檔案**：`css/shared.css`（`.trip-btn` / `.trip-btn.active` / `body.dark .trip-btn.active`）、`css/setting.css`（`.setting-trip-list .trip-btn.active`）、`css/edit.css`（新增 `.sticky-nav` 背景透明規則）
- **HTML/JS**：不需修改
- **JSON**：不需修改
