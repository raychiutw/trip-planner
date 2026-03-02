## 1. CSS — 隱藏 sticky-nav 與修正框線

- [x] 1.1 在 `css/setting.css` 中移除錯誤的 `@media (min-width: 768px) { .setting-page .sticky-nav { display: none; } }` 規則，改為 `.sticky-nav { display: none; }`（不限 media query，手機桌機皆隱藏）
- [x] 1.2 在 `css/setting.css` 中移除 `.setting-trip-list .trip-btn` 的 `border-left: 3px solid transparent` 與 `.trip-btn.active` 的 `border-left-color`，active 狀態僅保留均勻的 `box-shadow: 0 0 0 2px var(--accent)`

## 2. JS — 選擇行程後跳轉

- [x] 2.1 在 `js/setting.js` 的 `renderTripList()` click handler 中，`lsSet('trip-pref', slug)` 後加上 `window.location.href = 'index.html'` 跳轉，移除後續的 UI 更新邏輯（因為已離開頁面）

## 3. 測試

- [x] 3.1 執行 `npm test` 確認所有測試通過
