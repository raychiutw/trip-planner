## 1. HTML 結構改造

- [x] 1.1 移除 index.html 的 `<aside class="sidebar">` 和相關 HTML（sidebar-header、sidebar-nav、sidebar-toggle）
- [x] 1.2 移除 index.html 的 drawer HTML（`#menuDrop`、`#menuBackdrop`）及漢堡選單按鈕
- [x] 1.3 在 sticky-nav 左側新增 "Trip Planner" 品牌文字元素（手機版隱藏）
- [x] 1.4 在 sticky-nav 右側新增 `.nav-actions` 容器，包含列印模式按鈕與設定頁連結
- [x] 1.5 將 ℹ FAB（`#infoFab`）改為 Speed Dial 觸發按鈕，icon 改為 ▲ 三角形 inline SVG
- [x] 1.6 新增 Speed Dial 子項目 HTML 結構（5 個圓形按鈕 + backdrop）

## 2. CSS 佈局調整

- [x] 2.1 修改 `.page-layout` grid 為雙欄（移除 sidebar 欄），桌機 ≥1200px 為 `1fr var(--panel-w)`
- [x] 2.2 新增 tab 切換樣式：`.day-section` 預設 `display: none`，`.day-section.active` 為 `display: block`
- [x] 2.3 新增 `.print-mode .day-section` 全部 `display: block !important`
- [x] 2.4 新增 "Trip Planner" 品牌文字樣式（桌機顯示、手機 `display: none`）
- [x] 2.5 新增 `.nav-actions` 樣式（flex-shrink: 0、按鈕間距、桌機 icon+文字 / 手機純 icon）
- [x] 2.6 新增 Speed Dial 相關樣式（觸發按鈕、子項目排列、backdrop、展開/收合動畫、stagger delay）
- [x] 2.7 列印模式隱藏 Speed Dial（`.print-mode .speed-dial { display: none !important }`）

## 3. JS 邏輯改造

- [x] 3.1 修改 nav pills 產生邏輯：標籤從 "D1" 改為 "1"（純數字）
- [x] 3.2 修改 pill 點擊行為：從 anchor scroll 改為 tab 切換（toggle `.day-section.active`）
- [x] 3.3 移除 `buildMenu()` 中渲染 sidebar/drawer 的邏輯（index.html 專用）
- [x] 3.4 新增 sticky-nav 右側動作按鈕渲染（列印模式 + 設定頁連結，桌機 icon+文字 / 手機純 icon）
- [x] 3.5 新增 Speed Dial 互動邏輯（展開/收合、icon 切換、backdrop 點擊關閉）
- [x] 3.6 新增 Speed Dial 子項目點擊 → 關閉 Speed Dial + 開啟 Bottom Sheet（動態渲染對應內容）
- [x] 3.7 重構非天數 section 渲染函式（航班/清單/備案/緊急/建議）回傳 HTML string，供 Bottom Sheet 動態使用
- [x] 3.8 修改 `renderInfoPanel` 僅渲染至 `#infoPanel`，不再同時渲染 `#bottomSheetBody`

## 4. 測試更新

- [x] 4.1 更新 unit test：nav pills 標籤從 "D1" 改為 "1"
- [x] 4.2 新增 unit test：tab 切換邏輯（active class 切換）
- [x] 4.3 更新 E2E test：移除 sidebar/drawer 相關測試，更新 index.html 導航測試
- [x] 4.4 新增 E2E test：tab 切換行為（點擊 pill → 切換天數顯示）
- [x] 4.5 新增 E2E test：Speed Dial 展開/收合、子項目點擊開啟 Bottom Sheet
- [x] 4.6 新增 E2E test：sticky-nav 右側設定/列印按鈕（桌機 icon+文字、手機純 icon）
- [x] 4.7 更新 E2E test：列印模式下所有天數展開、Speed Dial 隱藏
