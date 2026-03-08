# 修正導覽列捲動兩項 bug + 回歸測試

## 問題

1. **桌機版 Day 錨點偏移**：點擊 nav pill 後，`switchDay()` 用 `scrollIntoView({ block: 'start' })` 將 day-header 對齊視窗頂部，但被 sticky-nav 蓋住。`scrollToSec()` 有正確的 offset 計算（扣除 nav 高度），但 `switchDay` 沒有用它。

2. **手機版 Day 1 pill 在畫面外**：`.dh-nav` 基礎樣式設 `justify-content: center`，當 pills 總寬超過容器時，`center` 讓左側溢出部分無法 scroll 到達，Day 1 被推到左邊不可見區域。

## 範圍

- `js/app.js`：`switchDay()` 改用手動 offset 計算
- `css/style.css`：`.dh-nav` 基礎改 `flex-start`，桌機 media query 保留 `center`
- `tests/e2e/trip-page.spec.js`：新增 2 條 E2E 測試
- `tests/unit/css-hig.test.js`：新增 1 條 CSS 靜態分析測試

## 不在範圍

- gradient mask 背景色與 frosted glass nav 不匹配（另案處理）
- `scrollToSec()` 函式本身（已正常運作）
