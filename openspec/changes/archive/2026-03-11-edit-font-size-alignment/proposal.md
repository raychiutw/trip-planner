## Why

edit.html 的字級整體比 index.html 小一級：issue 標題用 `--fs-footnote`（行程頁用 `--fs-title3`）、回覆本文用 `--fs-footnote`（行程頁用 `--fs-body`）、meta 用 `--fs-caption`（行程頁用 `--fs-footnote`）。兩頁閱讀體驗不一致，edit 頁文字偏小影響可讀性。

## What Changes

- `.issue-item-title`：mobile `--fs-footnote` → `--fs-callout`，desktop `--fs-body` → `--fs-title3`
- `.issue-item-body`：`--fs-footnote` → `--fs-callout`
- `.issue-item-meta`：`--fs-caption` → `--fs-footnote`
- `.issue-reply`：`--fs-footnote` → `--fs-body`
- `.issue-reply code`：`--fs-footnote` → `--fs-callout`
- `.edit-mode-pill`：`--fs-footnote` → `--fs-callout`

不動項目（badge 類維持小字級）：`.issue-badge`、`.issue-mode-badge`、`.edit-status`

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `edit-page`: 字級對齊行程頁，提升可讀性

## Impact

- 唯一修改檔案：`css/edit.css`
- 無 HTML / JS / JSON 變更
- 無 checklist / backup / suggestions 連動
