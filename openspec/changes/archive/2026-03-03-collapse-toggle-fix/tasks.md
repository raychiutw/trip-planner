## 1. Item 6 — 全旅程交通統計取消折疊

- [x] 1.1 `js/app.js`：`renderTripDrivingStats`（約第 321 行）— 最外層摘要列從 `<div class="col-row" role="button" aria-expanded="false">` 改為無 toggle 語意的 div，移除 `<span class="arrow">＋</span>`
- [x] 1.2 `js/app.js`：`renderTripDrivingStats` — 最外層 `<div class="col-detail">` 改為常駐展開（移除 `col-detail` class 或另行標記為不折疊），確保內容永遠可見
- [x] 1.3 `js/app.js`：`renderTripDrivingStats` — 各日明細列（Day 1、Day 2…）的 `<div class="col-row" role="button" aria-expanded="false">` 同樣移除 toggle 語意，移除 `<span class="arrow">＋</span>`，其子 `col-detail` 改為常駐展開
- [x] 1.4 確認 `renderDayTransport`（約第 273 行）**未被修改**，當日交通折疊行為維持不變

## 2. Item 11 — 展開箭頭統一全形字元

- [x] 2.1 `js/app.js`：`renderHourly`（約第 1270 行）— `<span class="hw-summary-arrow">+</span>` 改為 `<span class="hw-summary-arrow">＋</span>`
- [x] 2.2 `js/app.js`：`toggleHw`（約第 1092 行）— `arrow.textContent = isOpen ? '-' : '+'` 改為 `arrow.textContent = isOpen ? '－' : '＋'`
- [x] 2.3 `css/style.css`：`.hw-summary-arrow` 規則補上 `font-size: var(--fs-md); color: var(--gray);`

## 3. Item 15 — info panel 移除 offsetParent 檢查

- [x] 3.1 `js/app.js`：`renderInfoPanel`（約第 944 行）— 移除 `if (panel.offsetParent !== null || panel.offsetWidth !== 0)` 條件判斷，直接執行 `panel.innerHTML = html;`

## 4. 驗證

- [x] 4.1 執行 `npm test` 確認所有現有測試通過
- [x] 4.2 手動確認「全旅程交通統計」載入後立即展開，無箭頭，無點擊行為
- [x] 4.3 手動確認「當日交通」仍可點擊折疊/展開
- [x] 4.4 手動確認天氣摘要箭頭初始為 `＋`，展開後為 `－`，字型大小與顏色與行程卡片箭頭一致
- [x] 4.5 手動在 768–1199px 視口載入頁面後拉寬至 ≥1200px，確認 sidebar 有正確內容
