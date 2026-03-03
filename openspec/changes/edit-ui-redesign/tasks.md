## 1. 標題列 — edit.html + CSS + JS

- [x] 1.1 `edit.html`：在 `.sticky-nav` 內漢堡按鈕後加入 `<span class="nav-title" id="navTitle"></span>`
- [x] 1.2 `css/edit.css`：移除桌機版 `.chat-container .sticky-nav { display: none }`，改為 `.chat-container .sticky-nav .dh-menu { display: none }`
- [x] 1.3 `css/edit.css`：`.sticky-nav` 加上 `background: var(--card-bg)`（覆蓋原本 transparent），`.nav-title` 樣式（`font-size: var(--fs-md)`、`font-weight: 700`、`overflow: hidden`、`text-overflow: ellipsis`、`white-space: nowrap`）
- [x] 1.4 `js/edit.js`：`renderEditPage()` 中寫入 `navTitle.textContent = '編輯行程 · ' + config.tripName`

## 2. Issue 列表 — JS 結構改造

- [x] 2.1 `js/edit.js`：`renderIssues()` 將 `.message-user` 氣泡改為 `.issue-item` 列表項目，外層容器改為 `.issue-list`
- [x] 2.2 `js/edit.js`：每個 `.issue-item` 包含 `.issue-item-header`（status dot + 標題連結）和 `.issue-item-meta`（`#N · 時間 · open/closed` 文字）
- [x] 2.3 `js/edit.js`：status dot class 保持 `.status-dot.open` / `.status-dot.closed`（複用現有樣式）

## 3. Issue 列表 — CSS 樣式

- [x] 3.1 `css/edit.css`：新增 `.issue-list` 容器（`display: flex; flex-direction: column`）
- [x] 3.2 `css/edit.css`：新增 `.issue-item`（左對齊、`padding: 12px 0`、`border-bottom: 1px dashed var(--border)`），最後一項 `border-bottom: none`
- [x] 3.3 `css/edit.css`：新增 `.issue-item-header`（flex row、`gap: 8px`、`align-items: center`）
- [x] 3.4 `css/edit.css`：新增 `.issue-item-title`（`color: var(--text)`、`font-size: var(--fs-sm)`、`text-decoration: none`、hover 時 `color: var(--accent)` + underline）
- [x] 3.5 `css/edit.css`：新增 `.issue-item-meta`（`font-size: var(--fs-sm)`、`color: var(--text-muted)`、`margin-top: 2px`、`padding-left: 16px`（對齊 dot 後方））

## 4. 舊樣式清理

- [x] 4.1 `css/edit.css`：移除 `.message-user`、`.message-user-header`、`.message-user-title`、`.message-user-title:hover`、`.message-user-meta` 五組規則
- [x] 4.2 `css/edit.css`：移除 `body.dark .message-user` 深色覆蓋（如有）

## 5. Textarea 自動伸縮

- [x] 5.1 `js/edit.js`：textarea `rows` 從 `3` 改為 `1`
- [x] 5.2 `js/edit.js`：在 `input` event listener 中加入 auto-resize 邏輯（`textarea.style.height = 'auto'; textarea.style.height = textarea.scrollHeight + 'px'`）
- [x] 5.3 `js/edit.js`：送出成功清空 textarea 後重設高度

## 6. Enter 鍵送出

- [x] 6.1 `js/edit.js`：textarea 加 `keydown` listener — Enter（非 Shift）且 textarea 非空時呼叫 `submitRequest()` 並 `preventDefault()`
- [x] 6.2 `js/edit.js`：Shift+Enter 不攔截，保留預設換行行為

## 7. 深色 disabled 按鈕色碼修正

- [x] 7.1 `css/edit.css`：`body.dark .edit-send-btn:disabled` 的 `background: #3D3A37` 改為 `var(--hover-bg)`、`color: #9B9590` 改為 `var(--gray)`

## 8. 問候語空頁面垂直置中

- [x] 8.1 `css/edit.css`：新增 `.chat-messages-inner--centered`（`justify-content: center; flex: 1`）
- [x] 8.2 `js/edit.js`：`renderIssues()` 中，當 issues 為空時對 `.chat-messages-inner` 加上 `--centered` class；有 issues 時移除

## 9. 送出後樂觀插入

- [x] 9.1 `js/edit.js`：`submitRequest()` 成功後，用 API 回傳的 issue 物件組裝 `.issue-item` HTML 並插入 `#editIssues` 頂部
- [x] 9.2 `js/edit.js`：樂觀插入後移除 `.chat-messages-inner--centered` class（因已有 issue）
- [x] 9.3 `js/edit.js`：保留 `loadIssues()` 呼叫，API 完成後以完整資料覆蓋列表

## 10. 測試更新

- [x] 10.1 搜尋所有測試檔案中引用 `.message-user` 的斷言，更新為 `.issue-item`
- [x] 10.2 執行 `npm test` 確認 unit/integration 測試全過
- [x] 10.3 執行 `npm run test:e2e` 確認 E2E 測試全過
