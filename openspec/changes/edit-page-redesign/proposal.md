## Why

edit 頁面目前存在未使用的 UI 元素（+ 按鈕為 disabled、行程選擇器可由 URL 參數取代），issue 列表缺乏狀態篩選能力，且版面寬度未針對桌機優化。需精簡介面、強化 issue 狀態顯示、並改善響應式佈局。

## What Changes

- **移除 + 按鈕**：刪除工具列左側的 `edit-add-btn`（目前永遠 disabled）
- **移除行程選擇器**：刪除 `edit-trip-select` 下拉選單（行程由 URL `?trip=` 參數決定）
- **強化 issue 狀態**：在每筆 issue 前方顯示明確的狀態標示（open 綠色圓點 / closed 紫色圓點），確認現有實作是否完整
- **限制筆數**：API 只拉取最新 15 筆（`per_page=15`）
- **自訂捲軸**：issue 列表超出可視區域時使用全站統一的自訂捲軸樣式
- **桌機寬度**：頁面最大寬度改為 `60vw`，手機則依畫面大小滿版並保留間距
- **工具列簡化**：移除 + 按鈕和選擇器後，工具列只留 textarea + 送出按鈕

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `edit-page`：移除 + 按鈕與行程選擇器、API 筆數降為 15、頁面寬度改為 60vw 響應式

## Impact

- **JS**：`js/edit.js`（移除 `renderTripSelector()`、修改 `per_page`、簡化工具列渲染）
- **CSS**：`css/edit.css`（刪除 `.edit-add-btn` 和 `.edit-trip-select` 樣式、修改 `.edit-page` 寬度為響應式）
- **HTML**：`edit.html`（移除 + 按鈕和 select 元素）
- **JSON**：無變更
