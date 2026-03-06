## 1. Textarea 樣式與限制

- [x] 1.1 `js/edit.js` textarea 標籤新增 `maxlength="65536"` 屬性
- [x] 1.2 `css/edit.css` `.edit-textarea` font-size 從 `var(--fs-md)` 改為 `var(--fs-sm)`
- [x] 1.3 `css/edit.css` `.edit-textarea` max-height 從 `160px` 改為 `25vh`

## 2. Issue Label 機制

- [x] 2.1 `js/edit.js` `submitRequest` 的 labels 陣列從 `['trip-edit']` 改為 `['trip-edit', config.tripSlug]`
- [x] 2.2 `js/edit.js` `loadIssues` 查詢 URL 從 `?labels=trip-edit&state=all&per_page=20` 改為 `?labels={config.tripSlug}&state=all&per_page=20`

## 3. 測試

- [x] 3.1 `tests/e2e/edit-page.spec.js` 更新 textarea 相關測試（驗證 maxlength 屬性、字體大小）
