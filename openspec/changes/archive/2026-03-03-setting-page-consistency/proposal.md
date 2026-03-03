## Why

setting.html 的版面結構與 edit.html 不一致：sticky-nav 完全隱藏、無標題列、桌機版限寬用 `640px` 而非 `60vw`、整頁背景為 `var(--card-bg)` 無層次區分。需統一為與 edit 頁相同的版面骨架。

## What Changes

- **顯示標題列**：sticky-nav 從 `display: none` 改為顯示，標題「設定」，桌機版隱藏漢堡按鈕
- **移除整頁 card-bg 背景**：`.setting-page` 移除 `background: var(--card-bg)`，讓 body `--bg` 透出
- **桌機版限寬統一**：從 `max-width: 640px` 改為 `max-width: 60vw`
- **active 色碼統一**：`.color-mode-card.active` 的 `var(--blue)` 改為 `var(--accent)`

## Capabilities

### New Capabilities
- `setting-title-bar`: 設定頁面置頂標題列

### Modified Capabilities
- `setting-page`: 版面結構與 edit 頁一致化

## Impact

- **css/setting.css**：修改 sticky-nav 顯示規則、`.setting-page` 背景與限寬、active 色碼
- **setting.html**：sticky-nav 內加入標題文字容器
