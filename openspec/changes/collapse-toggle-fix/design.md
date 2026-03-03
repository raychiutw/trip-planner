## Approach

### Item 6 — 全旅程交通統計取消折疊

`renderTripDrivingStats`（app.js:321）目前將最外層摘要列與各日明細列都用 `.col-row[role="button"]` 包裝，並在其後接 `.col-detail`（預設隱藏）。

修改方式：

1. 最外層「全旅程交通統計」標頭列：改為普通 `<div class="col-header">`（或直接用現有的 non-interactive div），不加 `role="button"`，不加 `aria-expanded`，不加 `<span class="arrow">`。
2. 最外層 `.col-detail`：改為 `<div class="col-detail col-detail-open">`，搭配 CSS `display: block`（或直接移除折疊 class），讓內容永遠顯示。
3. 各日明細（Day 1、Day 2…）的 `.col-row`：同樣移除 `role="button"`、`aria-expanded`、`.arrow`，並將其後的 `.col-detail` 改為常駐展開。
4. `renderDayTransport`（app.js:273）維持原有折疊行為，**不修改**。

**替代方案考慮**：

- 方案 A（採用）：在 HTML 生成端直接移除 toggle 相關屬性與 arrow span，讓這些元素從 DOM 上不具備折疊語意。CSS 不需新增規則（`.col-detail-open` 若不存在，直接以 inline style 或不加 `col-detail` class 處理即可）。
- 方案 B（拒絕）：保留 `.col-row` 結構，僅用 CSS 強制 `.driving-summary .col-detail { display: block !important; }` 隱藏 arrow。問題：DOM 仍留有 `role="button"` 與 `aria-expanded`，螢幕閱讀器語意錯誤，且 click handler 仍可觸發（雖視覺無效果）。

### Item 11 — 展開箭頭統一全形字元

`renderHourly`（app.js:1270）生成 `.hw-summary-arrow` 時寫死 `+`（半形）；`toggleHw`（app.js:1092）以 `'-'` 和 `'+'`（半形）切換。

修改方式：

1. `renderHourly`：將 `<span class="hw-summary-arrow">+</span>` 改為 `<span class="hw-summary-arrow">＋</span>`。
2. `toggleHw`：`arrow.textContent` 賦值從 `'-'` / `'+'` 改為 `'－'` / `'＋'`。
3. `css/style.css`：`.hw-summary-arrow` 補上 `font-size: var(--fs-md); color: var(--gray);`，對齊 `.col-row .arrow` 的既有規則。

### Item 15 — info panel 移除 offsetParent 檢查

`renderInfoPanel`（app.js:944）有一條可見性守衛：

```js
if (panel.offsetParent !== null || panel.offsetWidth !== 0) {
    panel.innerHTML = html;
}
```

`panel`（`#infoPanel`）在 768–1199px 下為 `display: none`，此時 `offsetParent === null` 且 `offsetWidth === 0`，條件不成立，HTML 不寫入。當視口寬到 ≥1200px 時，CSS 將 panel 改為 `display: block`，但 `innerHTML` 仍為初始空字串，造成空白 sidebar。

修改方式：移除整個 if 條件，直接 `panel.innerHTML = html;`。寫入 `display: none` 的元素不會觸發 layout reflow，效能無影響。

## Files Changed

| 檔案 | 修改內容 |
|------|---------|
| `js/app.js` | `renderTripDrivingStats`：移除全旅程摘要列與各日列的 toggle 語意（role、aria-expanded、arrow span、col-detail class 調整） |
| `js/app.js` | `renderHourly`：`.hw-summary-arrow` 初始字元從 `+` 改為 `＋` |
| `js/app.js` | `toggleHw`：arrow textContent 從半形改全形 |
| `js/app.js` | `renderInfoPanel`：移除 `offsetParent` 可見性守衛 |
| `css/style.css` | `.hw-summary-arrow` 補 `font-size` 與 `color` |
