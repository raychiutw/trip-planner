## Why

edit.html 的修改請求輸入框缺乏字數限制、字體過大、高度過矮，使用體驗不佳。此外，目前建立的 GitHub Issue 只掛 `trip-edit` label，查詢時會混雜所有行程的 Issues，使用者無法只看到自己行程的修改紀錄。

## What Changes

- textarea 新增 `maxlength="65536"`（GitHub Issue body 上限）
- textarea 字體從 `var(--fs-md)`（18px）改為 `var(--fs-sm)`（14px）
- textarea 最大高度從 `160px` 改為 `25vh`（約視窗 1/4）
- 建立 Issue 時新增行程 slug 作為第二個 label：`labels: ['trip-edit', tripSlug]`
- 查詢 Issues 改用行程 slug label 過濾：`?labels={tripSlug}&state=all&per_page=20`，只顯示當前行程的 Issues

## Capabilities

### New Capabilities
- `edit-issue-per-trip`: edit.html 的 Issue 建立與查詢改為依行程 slug label 分類過濾

### Modified Capabilities
（無既有 spec 需修改）

## Impact

- **JS**：`js/edit.js`（submitRequest label 陣列、loadIssues 查詢參數）
- **CSS**：`css/edit.css`（.edit-textarea font-size、max-height）
- **HTML**：不需變更（textarea 由 JS 動態產生）
- **Skill**：`.claude/commands/tp-issue.md` 不需變更（仍用 `--label trip-edit` 掃描全部）
- **測試**：E2E 測試需更新 textarea 相關斷言
