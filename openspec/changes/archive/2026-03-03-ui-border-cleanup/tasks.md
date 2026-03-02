## 1. trip-btn active 邊框修正

- [x] 1.1 `shared.css`：`.trip-btn` 加 `border: 2px solid transparent`，`.trip-btn.active` 從 `box-shadow: 0 0 0 2px var(--blue)` 改為 `border-color: var(--accent)`
- [x] 1.2 `shared.css`：`body.dark .trip-btn.active` 同步改為 `border-color: var(--accent)`（移除 box-shadow）
- [x] 1.3 `setting.css`：`.setting-trip-list .trip-btn.active` 從 `box-shadow` 改為 `border-color: var(--accent)`

## 2. edit 頁 sticky-nav 背景透明

- [x] 2.1 `edit.css`：新增 `.sticky-nav { background: transparent; }` 消除頂部色條

## 3. 驗證

- [x] 3.1 執行 `npm test` 確認所有現有測試通過
