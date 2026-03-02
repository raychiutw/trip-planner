## Context

edit 頁面（`edit.html`）是 AI 修改行程的聊天介面。目前工具列包含三個元素：+ 按鈕（永遠 disabled）、行程選擇器（`<select>`）、送出按鈕。行程選擇器功能可由 URL 參數 `?trip=` 完全取代。頁面最大寬度固定 640px，桌機上偏窄。

現有結構：
- `.edit-page { max-width: 640px }`
- `.edit-input-toolbar` 包含 `.edit-add-btn` + `.edit-trip-select` + `.edit-send-btn`
- `edit.js` 的 `renderTripSelector()` 渲染下拉選單
- API 呼叫 `per_page=20`

## Goals / Non-Goals

**Goals:**
- 移除冗餘 UI 元素（+ 按鈕、行程選擇器）
- API 只取最新 15 筆 issue
- 頁面寬度桌機 60vw、手機滿版留間距
- 工具列簡化為 textarea + 送出按鈕

**Non-Goals:**
- 不改變送出流程（GitHub Issue API）
- 不新增 issue 篩選/搜尋功能
- 不修改問候語區塊

## Decisions

### D1: 移除 + 按鈕與行程選擇器

**選擇**：
1. `edit.html` 刪除 `.edit-add-btn` 和 `.edit-trip-select` 元素
2. `edit.css` 刪除 `.edit-add-btn` 和 `.edit-trip-select` 相關樣式
3. `edit.js` 刪除 `renderTripSelector()` 函式及其呼叫

**理由**：+ 按鈕從未啟用（`cursor: not-allowed`），行程由 URL `?trip=` 參數決定，選擇器多餘。

### D2: 工具列簡化

**選擇**：移除後工具列只留 textarea（上方）+ 送出按鈕（右下），用 flex row 排列。

**替代方案**：textarea 和送出按鈕垂直排列 → 拒絕，水平排列更省空間且符合聊天 UI 慣例。

### D3: 頁面寬度響應式

**選擇**：
```css
.edit-page {
    max-width: 60vw;   /* 桌機 */
    margin: 0 auto;
    padding: 0 16px;
}
@media (max-width: 768px) {
    .edit-page {
        max-width: 100%;  /* 手機滿版 */
        padding: 0 12px;  /* 保留間距 */
    }
}
```

**理由**：60vw 在 1920px 螢幕上約 1152px，配合 sidebar 後主內容區域適中。手機保持滿版，左右留 12px 間距。

### D4: API 筆數限制

**選擇**：`per_page=20` → `per_page=15`。

**理由**：減少不必要的 API 請求量，15 筆足以顯示近期紀錄。issue 列表已有 `overflow-y: auto` 捲動。

### D5: issue 狀態顯示確認

現有實作已有 `.edit-issue-status` 元素（open=綠色圓點、closed=灰色），維持不變。確認 closed 顏色為 `var(--gray)` 而非紫色（與 spec 中的「紫色」描述有差異，以現有實作為準）。

## Risks / Trade-offs

- [60vw 在小桌機可能偏窄] → 768px 以下會切換為 100%，768-1024px 之間 60vw ≈ 460-614px，與原本 640px 相近，可接受
- [移除行程選擇器後無法頁內切換行程] → 使用者需透過選單導航，這已是標準流程
