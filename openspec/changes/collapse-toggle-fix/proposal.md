## Why

「全旅程交通統計」區塊目前使用與日程卡片相同的 `.col-row` 折疊機制，但其作為全旅程的摘要資訊，每次進入頁面都需額外點擊才能看到，降低資訊可及性。天氣摘要列的展開箭頭使用半形 `+/-`，與行程卡片的全形 `＋/－` 不一致，造成字型大小與視覺對齊參差不齊。info panel 在 768–1199px 視口下因 `display: none` 被 `offsetParent` 檢查跳過渲染，導致使用者將視窗拉寬至 ≥1200px 時，sidebar 內容空白。

## What Changes

- **Item 6 — 全旅程交通統計取消折疊**：`renderTripDrivingStats` 中的「全旅程交通統計」標頭列及各日明細列，改為永遠展開：移除 `role="button"`、`aria-expanded`、`.arrow` span；`col-detail` 改為不需 toggle 直接顯示（不使用 `.col-row` 的 click 行為）。當日交通（`renderDayTransport` 內）保持折疊不變。

- **Item 11 — 展開箭頭統一全形字元**：`toggleHw` 函式與 `renderHourly` 函式中的半形 `+`、`-` 全部改為全形 `＋`、`－`；`hw-summary-arrow` CSS 補上 `font-size: var(--fs-md)` 及 `color: var(--gray)`，與 `.col-row .arrow` 對齊。

- **Item 15 — info panel 移除 offsetParent 檢查**：`renderInfoPanel` 中移除 `if (panel.offsetParent !== null || panel.offsetWidth !== 0)` 條件判斷，改為無條件寫入 `panel.innerHTML = html`，確保 panel 不論是否可見都有正確 HTML。

## Scope

- **JS**：`js/app.js`（`renderTripDrivingStats`、`toggleHw`、`renderHourly`、`renderInfoPanel`）
- **CSS**：`css/style.css`（`.hw-summary-arrow` 補充 font-size 與 color）
- **HTML / JSON / tests**：不需修改
