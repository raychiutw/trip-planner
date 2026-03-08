# 設計

## D1：switchDay 改用手動 offset 計算

現有 `scrollToSec()` 已有正確邏輯：
```js
var top = el.getBoundingClientRect().top + window.pageYOffset - navH - navTop;
window.scrollTo({ top: top, behavior: 'smooth' });
```

`switchDay()` 改為相同做法，取代 `scrollIntoView`。不直接呼叫 `scrollToSec` 是因為 `switchDay` 還需要處理 pill active 切換和 hash 更新。

## D2：.dh-nav justify-content 修正

基礎樣式改為 `flex-start`（手機版預設），桌機版 media query 保留 `center`。

現有 `@media (min-width: 768px) { .dh-nav { justify-content: center; } }` 已存在（line 86），只需移除基礎樣式中的 `center`。

## D3：測試策略

| 測試 | 類型 | 驗證 |
|------|------|------|
| Day pill 點擊後 header 不被 nav 蓋住 | E2E | day-header.top >= stickyNav.bottom |
| 手機版 Day 1 pill 在視窗內 | E2E (375x812) | pill.boundingBox().x >= 0 |
| .dh-nav 基礎不含 center | CSS HIG | 靜態分析排除 @media 區塊後檢查 |
