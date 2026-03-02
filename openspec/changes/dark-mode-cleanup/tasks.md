## 1. 補上 --card-bg 深色變數

- [x] 1.1 在 `css/shared.css` 的 `body.dark` 中加入 `--card-bg: #292624`

## 2. 亮色模式硬編碼改為 var(--blue)

- [x] 2.1 `css/menu.css`：`.menu-item-current { color: #C4704F }` → `var(--blue)`
- [x] 2.2 `css/edit.css`：`.edit-spark { color: #C4704F }` → `var(--blue)`
- [x] 2.3 `css/edit.css`：`.edit-send-btn:not(:disabled) { background: #C4704F }` → `var(--blue)`
- [x] 2.4 `css/setting.css`：`.trip-btn.active` 的 `border-left-color` 和 `box-shadow` 中的 `#C4704F` → `var(--blue)`
- [x] 2.5 `css/setting.css`：`.color-mode-card.active` 的 `border-color` 和 `box-shadow` 中的 `#C4704F` → `var(--blue)`

## 3. 刪除 style.css 冗餘 dark 覆蓋

- [x] 3.1 刪除 `body.dark .map-link { color: #D4845E; background: #302A25 }`
- [x] 3.2 刪除 `body.dark .map-link.mapcode { color: var(--sand); background: var(--sand-light) }`
- [x] 3.3 刪除 `body.dark .hotel-sub { background: #302A25 }`
- [x] 3.4 刪除 `body.dark .driving-stats-warning { background: transparent }`
- [x] 3.5 刪除 `body.dark .info-card { background: #292624 }`
- [x] 3.6 刪除 `body.dark .ov-card { background: #302A25 }`

## 4. 刪除 menu.css 冗餘 dark 覆蓋

- [x] 4.1 刪除 `body.dark .sidebar-toggle { color: #E8E5E0 }`
- [x] 4.2 刪除 `body.dark .sidebar-toggle:hover { background: #302A25 }`
- [x] 4.3 刪除 `body.dark .sidebar .menu-item { color: #E8E5E0 }`
- [x] 4.4 刪除 `body.dark .sidebar .menu-item:hover { background: #302A25 }`
- [x] 4.5 刪除 `body.dark .sidebar .sidebar-section-title { color: #9B9590 }`
- [x] 4.6 刪除 `body.dark .menu-item-current { color: #D4845E }`（因 task 2.1 已改用 `var(--blue)`）

## 5. 刪除 edit.css 冗餘 dark 覆蓋

- [x] 5.1 刪除 `body.dark .edit-issue-item { background: #292624 }`
- [x] 5.2 刪除 `body.dark .edit-issue-title { color: #E8E5E0 }`
- [x] 5.3 刪除 `body.dark .edit-textarea { color: #E8E5E0 }`
- [x] 5.4 刪除 `body.dark .edit-send-btn:not(:disabled) { background: #C4704F; color: #fff }`（因 task 2.3 已改用 `var(--blue)`）

## 6. 刪除 setting.css 冗餘 dark 覆蓋

- [x] 6.1 刪除 `body.dark .color-mode-card.active { border-color: #D4845E; box-shadow: 0 0 0 1px #D4845E }`（因 task 2.5 已改用 `var(--blue)`）
- [x] 6.2 刪除 `body.dark .setting-trip-list .trip-btn.active { border-left-color: #D4845E; box-shadow: 0 0 0 2px #D4845E }`（因 task 2.4 已改用 `var(--blue)`）

## 7. 驗證

- [x] 7.1 執行全部測試確認通過
