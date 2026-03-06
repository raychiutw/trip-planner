## 1. Icon 準備

- [x] 1.1 在 `js/icons.js` 的 ICONS 物件中新增 `circle-dot` icon（外圓+內圓 SVG）

## 2. Badge 實作

- [x] 2.1 修改 `buildIssueItemHtml()`：在 title `<a>` 前插入 `<span class="issue-badge open/closed">` 含對應 icon + 文字
- [x] 2.2 新增 `.issue-badge` CSS pill 樣式（`border-radius: 999px`、`--fs-sm`、白字、`display: inline-flex`、`align-items: center`、`gap: 4px`）
- [x] 2.3 新增 `.issue-badge.open` 樣式（`background: #238636`）
- [x] 2.4 新增 `.issue-badge.closed` 樣式（`background: #8957e5`）

## 3. 移除舊狀態指示

- [x] 3.1 移除 `.issue-item` 的 `border-left: 3px solid transparent`
- [x] 3.2 移除 `.issue-item.open` 的 `border-left-color`
- [x] 3.3 移除 `.issue-item.closed` 的 `border-left-color` 和 `opacity: 0.55`

## 4. Close Reply 非同步載入

- [x] 4.1 修改 `buildIssueItemHtml()`：當 `state === 'closed' && comments > 0` 時，在 meta 下方加入 `<div class="issue-reply" id="reply-{number}">讀取回覆中…</div>`
- [x] 4.2 新增 `loadIssueReplies(issues)` 函式：收集需 fetch 的 issue，並行呼叫 comment API，取最後一則 comment 的 body 以 `textContent` 寫入對應 DOM
- [x] 4.3 在 `renderIssues()` 結尾呼叫 `loadIssueReplies(issues)`
- [x] 4.4 新增 `.issue-reply` CSS 樣式（`--fs-sm`、`--text-muted`、`margin-top: 2px`）
- [x] 4.5 fetch 失敗時將對應 reply 元素的文字改為「無法載入回覆」

## 5. 桌機版 Title 放大

- [x] 5.1 新增 `@media (min-width: 768px)` 規則：`.issue-item-title { font-size: var(--fs-md) }`

## 6. 測試

- [x] 6.1 新增 unit test：`buildIssueItemHtml` open issue 輸出包含 `.issue-badge.open`
- [x] 6.2 新增 unit test：`buildIssueItemHtml` closed issue 輸出包含 `.issue-badge.closed`
- [x] 6.3 新增 unit test：`buildIssueItemHtml` closed + comments > 0 輸出包含 `.issue-reply` placeholder
- [x] 6.4 新增 unit test：`buildIssueItemHtml` open issue 不包含 `.issue-reply`
- [x] 6.5 確認所有既有測試通過
