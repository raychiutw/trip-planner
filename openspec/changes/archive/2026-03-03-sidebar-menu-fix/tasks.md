# Tasks: sidebar-menu-fix

## 1. CSS — 收合 sidebar 寬度調整

- [x] 1.1 `css/shared.css`：`--sidebar-w-collapsed` 值從 `56px` 改為 `64px`
- [x] 1.2 `css/menu.css`：`.sidebar.collapsed .sidebar-header` 的 `padding` 從 `8px` 改為 `8px 4px`

## 2. CSS — sidebar-toggle outline 清除

- [x] 2.1 `css/menu.css`：`.sidebar-toggle` 主規則加入 `outline: none;`，確保所有狀態（:focus、:focus-within 等）無殘留 outline
- [x] 2.2 確認 `css/shared.css` 中 `.sidebar-toggle:focus-visible` 的 `box-shadow` 規則完整保留（鍵盤存取性不退化）

## 3. JS — isDesktop() 改為視窗寬度判斷

- [x] 3.1 `js/menu.js`：將 `isDesktop()` 實作由 `!/Mobi|Android.*Mobile|iPhone|iPod|Opera Mini/i.test(navigator.userAgent)` 改為 `return window.innerWidth >= 768;`

## 4. 驗證

- [x] 4.1 執行完整測試套件（`npm test`），確認全數通過
- [x] 4.2 手動驗證：桌機瀏覽器縮小至 <768px，點擊漢堡按鈕應正確開啟 mobile drawer
- [x] 4.3 手動驗證：sidebar 收合後 icon 完整顯示（含捲動條出現時）
- [x] 4.4 手動驗證：點擊 sidebar-toggle 後無橘色/深色 outline 出現
