## 1. CSS 修正

- [x] 1.1 `css/style.css`：`.dh-nav` 基礎樣式移除 `justify-content: center`（改為 `flex-start` 或省略）
- [x] 1.2 確認 `@media (min-width: 768px) { .dh-nav { justify-content: center; } }` 已存在（不需新增）

## 2. JS 修正

- [x] 2.1 `js/app.js`：`switchDay()` 將 `header.scrollIntoView({ behavior: 'smooth', block: 'start' })` 改為手動 offset 計算（與 `scrollToSec()` 相同邏輯：扣除 nav 高度 + navTop + 間距）

## 3. 測試

- [x] 3.1 `tests/unit/css-hig.test.js`：新增測試「.dh-nav 基礎樣式不含 justify-content: center」（排除 @media 區塊內的規則）
- [x] 3.2 `tests/e2e/trip-page.spec.js`：新增測試「點擊 Day pill 後 day-header 不被 sticky-nav 遮住」（比較 boundingBox）
- [x] 3.3 `tests/e2e/trip-page.spec.js`：新增測試「手機版 Day 1 pill 在視窗內可見」（375px viewport，檢查 boundingBox().x >= 0）

## 4. 驗證

- [x] 4.1 執行 `npm test` 確認全部通過 → 582 tests all passed
