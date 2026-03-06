## 1. CSS 樣式變更

- [x] 1.1 `css/edit.css`：`.issue-item` 加 `border-left: 3px solid transparent` + `padding-left: 12px`
- [x] 1.2 `css/edit.css`：新增 `.issue-item.open { border-left-color: var(--success); }`
- [x] 1.3 `css/edit.css`：新增 `.issue-item.closed { border-left-color: var(--text-muted); opacity: 0.55; }`
- [x] 1.4 `css/edit.css`：移除 `.status-dot`、`.status-dot.open`、`.status-dot.closed` 樣式

## 2. JS 邏輯變更

- [x] 2.1 `js/edit.js` `buildIssueItemHtml`：`.issue-item` 加上 `open`/`closed` class
- [x] 2.2 `js/edit.js` `buildIssueItemHtml`：移除 `<span class="status-dot">` 輸出
- [x] 2.3 `js/edit.js` `buildIssueItemHtml`：meta 行移除 `stateText`，格式改為 `#number · date`
- [x] 2.4 `js/edit.js` `submitRequest`：title 從 `'[trip-edit] ' + owner + ': '` 改為 `owner + ': '`

## 3. 測試更新

- [x] 3.1 `tests/unit/edit.test.js`：更新 unit test 驗證 issue-item 有 open/closed class、無 status-dot、meta 無狀態文字
- [x] 3.2 `tests/unit/edit.test.js`：更新 header 結構測試移除 status-dot 斷言
