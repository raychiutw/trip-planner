## Why

localStorage key 的 `trip-planner-` prefix 過長且冗餘。此外，當 localStorage 記住的行程 slug 對應的 JSON 已不存在（行程刪除或改名），使用者每次進入網站都會卡在錯誤畫面「載入失敗」，無法自行恢復。

## What Changes

- **BREAKING** `LS_PREFIX` 從 `trip-planner-` 改為 `tp-`，所有 localStorage key 縮短（`tp-trip-pref`、`tp-color-mode`、`tp-dark`、`tp-sidebar-collapsed`）
- 新增遷移邏輯：偵測到舊 `trip-planner-*` prefix key 時自動搬移至 `tp-*`，刪除舊 key
- 行程載入失敗（fetch 失敗）時：清除 `trip-pref`，在頁面主內容區顯示「行程不存在」訊息與前往設定頁的按鈕連結，不再 fallback 載入預設行程
- 移除 `DEFAULT_SLUG` 常數及其 fallback 邏輯

## Capabilities

### New Capabilities
- `trip-load-fallback`: 行程載入失敗時的錯誤處理與復原機制（清 trip-pref、顯示訊息與設定頁連結）

### Modified Capabilities
（無既有 spec 需修改）

## Impact

- **JS**：`js/shared.js`（LS_PREFIX 改名）、`js/app.js`（遷移邏輯、loadTrip 失敗處理、移除 DEFAULT_SLUG）
- **CSS**：`css/style.css`（錯誤訊息區塊樣式，沿用 `.trip-error` 或擴充）
- **HTML**：不需變更
- **JSON**：不涉及行程 JSON 結構變更，checklist/backup/suggestions 不受影響
- **測試**：unit test 需更新 localStorage 相關測試
