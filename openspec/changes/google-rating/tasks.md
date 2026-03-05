# Tasks: google-rating

## 1. JSON Schema 驗證

- [x] 1.1 在 `tests/json/schema.test.js` 的 timeline event 驗證區塊新增：若含 `googleRating` 欄位，值 SHALL 為數字且介於 1.0–5.0
- [x] 1.2 在 `tests/json/schema.test.js` 的 restaurant 驗證區塊新增：若含 `googleRating` 欄位，值 SHALL 為數字且介於 1.0–5.0
- [x] 1.3 在 `tests/json/schema.test.js` 的 shop 驗證區塊新增：若含 `googleRating` 欄位，值 SHALL 為數字且介於 1.0–5.0
- [x] 1.4 確認 `googleRating` 欄位缺失時現有 schema 測試仍通過（選填，不報錯）

## 2. 渲染

- [x] 2.1 在 `js/app.js` 的 `renderTimelineEvent` 函式中，於標題渲染後加入：若 `ev.googleRating` 存在，輸出 `<span class="google-rating">` + `iconSpan('star')` + `ev.googleRating.toFixed(1)` + `</span>`
- [x] 2.2 在 `js/app.js` 的 `renderRestaurant` 函式中，於 meta 行加入：若 `r.googleRating` 存在，輸出 `<span class="google-rating">` + `iconSpan('star')` + `r.googleRating.toFixed(1)` + `</span>`
- [x] 2.3 在 `js/app.js` 的 `renderShop` 函式中，於 meta 行加入：若 `s.googleRating` 存在，輸出 `<span class="google-rating">` + `iconSpan('star')` + `s.googleRating.toFixed(1)` + `</span>`

## 3. CSS

- [x] 3.1 在 `css/style.css` 新增 `.google-rating` class：`display: inline-flex; align-items: center; gap: 2px;`
- [x] 3.2 在 `.google-rating` 內的 star icon：`color: var(--accent);`
- [x] 3.3 確認數字文字繼承正常文字色（不另設 `color`）

## 4. R12 品質規則

- [x] 4.1 在 `tests/json/quality.test.js` 新增 R12 規則：遍歷所有 timeline event，若 event 非 transit、非含「餐廳未定」，且缺少 `googleRating`，以 `console.warn` 輸出 `Day X "${title}" missing googleRating`
- [x] 4.2 在 `tests/json/quality.test.js` 新增 R12 規則：遍歷所有 restaurant 物件，若缺少 `googleRating`，以 `console.warn` 輸出 `Day X "${name}" missing googleRating`
- [x] 4.3 確認 R12 為 warn 模式：測試本身 SHALL 通過（不因缺少 `googleRating` 而 fail）

## 5. Info 面板

- [x] 5.1 在 `js/app.js` 的 `renderInfoPanel(data)` 函式中，移除 `renderHighlights(...)` 的呼叫及對應 HTML 輸出段落
- [x] 5.2 確認 `renderHighlights` 函式定義仍保留在 `app.js` 中
- [x] 5.3 確認主內容區對 `renderHighlights` 的呼叫仍存在且正常渲染

## 6. 驗證

- [x] 6.1 執行 `npm test` 確認所有測試通過
