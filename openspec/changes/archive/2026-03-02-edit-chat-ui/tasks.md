## 1. CSS — Chat Container Layout

- [x]1.1 重寫 `css/edit.css`：移除舊有表單式 layout 規則，建立 `.chat-container` 為 `display: flex; flex-direction: column`，高度使用 `calc(100vh - var(--nav-h))` 與 `calc(100dvh - var(--nav-h))` 雙層宣告
- [x]1.2 新增 `.chat-messages` 樣式：`flex: 1; overflow-y: auto; padding`，作為可捲動訊息區域
- [x]1.3 新增 `.chat-messages-inner` wrapper 樣式：桌機版 `@media (min-width: 768px)` 下套用 `max-width: 60vw; margin: 0 auto`

## 2. CSS — 訊息氣泡樣式

- [x]2.1 新增 `.message-system` 樣式：左對齊，`max-width: 80%`，白色圓角卡片（`border-radius: 12px`），含適當 `padding` 與 `box-shadow`
- [x]2.2 新增 `.message-user` 樣式：右對齊（`margin-left: auto`），`max-width: 80%`，使用主色背景或輕色背景圓角氣泡
- [x]2.3 新增 issue 狀態標記樣式：`.status-dot` 為 `8px × 8px` 圓點，`--color-success`（open）與 `var(--color-text-secondary)`（closed）兩種變體

## 3. CSS — 底部輸入框

- [x]3.1 重寫底部輸入框容器樣式：移除舊有 `position: fixed` 規則，改為 chat container 底部的 flex 子元素，`border-radius: 16px`，適當 `padding` 與 `box-shadow`
- [x]3.2 確認送出按鈕 disabled 狀態暗色 / 啟用狀態 `#C4704F` CSS 規則正確，無硬編碼 `font-size`

## 4. JS — renderEditPage() 改為 Chat Layout

- [x]4.1 修改 `js/edit.js` 的 `renderEditPage()` 函式：產生 `.chat-container > .chat-messages > .chat-messages-inner` HTML 結構
- [x]4.2 問候語改為產生 `.message-system` 卡片 HTML（含 Spark icon、時段問候文字、副標），移除舊有 greeting 卡片的 HTML 結構
- [x]4.3 更新對應 unit test（`tests/unit/edit.test.js` 或相關測試檔），確認新 DOM 結構與 class 名稱

## 5. JS — renderIssues() 改為氣泡渲染

- [x]5.1 修改 `js/edit.js` 的 `renderIssues()` 函式：每筆 issue 產生 `.message-user` 氣泡 HTML，包含標題（`<a>` 連結）、編號、建立時間
- [x]5.2 在氣泡內加入 `.status-dot` 狀態圓點，依 issue `state` 值（`open` / `closed`）套用對應 CSS class
- [x]5.3 更新對應 unit test，確認 open / closed issue 分別渲染出正確 class 的狀態圓點

## 6. 桌機版 Responsive 調整

- [x]6.1 確認桌機版 CSS Grid 結構（sidebar + chat 分欄）與新 chat container 相容，sidebar 寬度不受影響
- [x]6.2 驗證 `max-width: 60vw` 在 1280px 與 1920px 螢幕下訊息不過寬，調整必要的 `padding` 設定

## 7. 測試驗證

- [x]7.1 更新或新增 E2E 測試（`tests/e2e/`）：驗證 chat container 存在、系統訊息左對齊、issue 氣泡右對齊
- [x]7.2 執行完整測試套件（unit + E2E），確認全數通過後再 commit
