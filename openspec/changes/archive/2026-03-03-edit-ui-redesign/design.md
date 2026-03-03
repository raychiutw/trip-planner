## Context

edit.html 目前以聊天式 UI 呈現 issue 歷史（右對齊氣泡）和系統問候語（左對齊卡片）。桌機版 sticky-nav 完全隱藏，使用者無法看到行程名稱。本次改造將 issue 列表改為左對齊列表式，並新增全裝置可見的標題列。

現有結構：
- `edit.html`：`.sticky-nav` 內只有漢堡按鈕，桌機版 `display: none`
- `js/edit.js`：`renderIssues()` 以 `.message-user` 右對齊氣泡渲染 issue
- `css/edit.css`：`.message-user` 系列樣式控制右對齊氣泡外觀

## Goals / Non-Goals

**Goals:**
- Issue 列表改為左對齊列表式，提高可讀性
- 新增置頂標題列，顯示「編輯行程 · {行程名稱}」
- 桌機版標題列隱藏漢堡按鈕（避免與 sidebar 重複）
- Textarea 自動伸縮 + Enter 鍵送出
- 問候語在無 issue 時垂直置中
- 送出後樂觀插入新 issue 到列表
- 深色 disabled 按鈕硬寫色碼改用 CSS 變數

**Non-Goals:**
- 不改動 issue 的 GitHub API 拉取邏輯（樂觀插入不取代 API 重拉）
- 不改動問候語的時段規則
- 不改動 sidebar/menu 系統

## Decisions

### D1: Issue 列表改為左對齊列表項目（棄用右對齊氣泡）

**選擇**：移除 `.message-user` 氣泡樣式，改用新的 `.issue-item` 列表項目樣式，每項之間用虛線分隔。

**替代方案**：保留氣泡但改左對齊 — 但氣泡隱含「對話」語意，列表式更適合歷史紀錄瀏覽。

**實作**：
- 新增 `.issue-list` 容器 + `.issue-item` 列表項目
- 每個 item 含 status dot、標題連結、meta 行（`#N · 時間 · open/closed`）
- item 之間用 `border-bottom: 1px dashed var(--border)` 分隔

### D2: 標題列複用 `.sticky-nav`

**選擇**：在現有 `.sticky-nav` 內新增標題文字容器 `.nav-title`，桌機版保留但隱藏漢堡按鈕。

**替代方案**：建立全新 `.edit-header` 元素 — 但 sticky-nav 已有定位邏輯和背景色，複用更簡潔。

**實作**：
- `edit.html` 的 `.sticky-nav` 加入 `<span class="nav-title">` 容器
- `js/edit.js` 的 `renderEditPage()` 動態寫入行程名稱
- `css/edit.css` 移除桌機版 `display: none`，改為隱藏 `.dh-menu` 漢堡按鈕
- 標題文字用 `var(--fs-md)`，溢位 `text-overflow: ellipsis`

### D3: 移除不再使用的 `.message-user` 相關 CSS

**選擇**：完全移除 `.message-user`、`.message-user-header`、`.message-user-title`、`.message-user-meta` 等氣泡樣式，因為不再有任何元素使用。

**理由**：避免死碼殘留，保持 CSS 乾淨。

### D4: Textarea 自動伸縮

**選擇**：在 `input` event listener 中動態設定 `textarea.style.height`（先 reset 為 `auto`，再設為 `scrollHeight + 'px'`），受 `max-height: 160px` 限制。

**理由**：原生 JS 即可實現，不需額外 library。`rows="3"` 改為 `rows="1"` 讓初始高度更小。

### D5: Enter 鍵送出

**選擇**：在 textarea 上加 `keydown` listener — Enter 觸發 `submitRequest()`、Shift+Enter 保留換行預設行為。

**理由**：符合主流 chat 介面慣例（Claude.ai、Slack 等）。

### D6: 深色 disabled 按鈕色碼改用 CSS 變數

**選擇**：`body.dark .edit-send-btn:disabled` 的 `background: #3D3A37` 改為 `var(--hover-bg)`、`color: #9B9590` 改為 `var(--gray)`。

**理由**：color-system-fix 修正了 selector 精度但遺漏了值本身，此處補齊。

### D7: 問候語空頁面垂直置中

**選擇**：`.chat-messages-inner` 在只有問候語（無 issue）時加上 `justify-content: center; flex: 1`，使問候語垂直居中。透過 JS 在 issues 為空時加 class `.chat-messages-inner--centered`。

**替代方案**：純 CSS 用 `:has()` 偵測 — 但 `:has()` 在舊瀏覽器支援不全，且 JS 控制更精確。

### D8: 送出後樂觀插入

**選擇**：`submitRequest()` 成功後，在 `loadIssues()` 重拉前，先將新 issue 以 `.issue-item` 格式插入列表頂部（樂觀更新），API 回傳後再用完整資料覆蓋。

**理由**：避免使用者送出後看不到自己的 issue（API 有延遲），提升即時感。

## Risks / Trade-offs

- [Issue 列表左對齊後密度較高] → 用虛線分隔 + 適當 padding 保持可讀性
- [桌機版標題列可能與 sidebar header 視覺重複] → 標題列只顯示行程名稱不顯示漢堡按鈕，與 sidebar 功能不重疊
- [移除 .message-user 樣式可能影響測試] → 需更新引用這些 class 的測試
- [樂觀插入的 issue 資料不完整（缺 html_url、number 等）] → 用 API 回傳的完整 issue 物件構建，確保資料齊全
- [Enter 送出可能在行動裝置上干擾輸入法] → 行動裝置通常用虛擬鍵盤的 Enter 不觸發 keydown，影響有限
