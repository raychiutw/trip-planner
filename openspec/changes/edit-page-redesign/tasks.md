## 1. 移除冗餘 UI 元素

- [ ] 1.1 `edit.html`：刪除 `.edit-add-btn` 元素
- [ ] 1.2 `edit.html`：刪除 `.edit-trip-select` 元素
- [ ] 1.3 `edit.css`：刪除 `.edit-add-btn` 相關樣式
- [ ] 1.4 `edit.css`：刪除 `.edit-trip-select` 相關樣式
- [ ] 1.5 `edit.js`：刪除 `renderTripSelector()` 函式及其呼叫

## 2. API 筆數調整

- [ ] 2.1 `edit.js`：`per_page=20` 改為 `per_page=15`

## 3. 頁面響應式寬度

- [ ] 3.1 `edit.css`：`.edit-page` 的 `max-width` 從 `640px` 改為 `60vw`
- [ ] 3.2 `edit.css`：新增 `@media (max-width: 768px)` 規則，`.edit-page { max-width: 100%; padding: 0 12px }`

## 4. 工具列簡化

- [ ] 4.1 調整 `.edit-input-toolbar` 佈局，移除 + 按鈕和選擇器後僅留送出按鈕（右對齊）

## 5. 測試更新

- [ ] 5.1 更新 edit 頁相關單元測試（移除 renderTripSelector 測試、驗證新工具列結構）
- [ ] 5.2 執行全部測試確認通過
