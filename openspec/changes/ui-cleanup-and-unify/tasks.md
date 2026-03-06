## 1. 刪除 menu 系統

- [ ] 1.1 刪除 `js/menu.js` 檔案
- [ ] 1.2 刪除 `css/menu.css` 檔案
- [ ] 1.3 index.html 移除 `<script src="js/menu.js">` 和 `<link rel="stylesheet" href="css/menu.css">`
- [ ] 1.4 edit.html 移除 `<script src="js/menu.js">` 和 `<link rel="stylesheet" href="css/menu.css">`
- [ ] 1.5 setting.html 移除 `<script src="js/menu.js">` 和 `<link rel="stylesheet" href="css/menu.css">`
- [ ] 1.6 app.js 移除 `buildMenu()` 函式及 `renderTrip` 中的 `buildMenu(data)` 呼叫
- [ ] 1.7 app.js 移除所有 `closeMobileMenuIfOpen()` 呼叫和 menu.js 依賴註解
- [ ] 1.8 edit.js 移除 `buildPageNav` 呼叫及 `menuGrid`/`sidebarNav` DOM 操作
- [ ] 1.9 setting.js 移除 `buildPageNav` 呼叫及 `menuGrid`/`sidebarNav` DOM 操作
- [ ] 1.10 tests/setup.js 移除 menu.js 的 `require` 和 global promote 區塊

## 2. edit/setting HTML 改造

- [ ] 2.1 edit.html 移除 `<aside class="sidebar">`、`#menuDrop`、`#menuBackdrop`、`.dh-menu` 漢堡按鈕
- [ ] 2.2 edit.html sticky-nav 改為：`.nav-title` + `.nav-close-btn`（X → index.html?trip=slug）
- [ ] 2.3 setting.html 移除 `<aside class="sidebar">`、`#menuDrop`、`#menuBackdrop`、`.dh-menu` 漢堡按鈕
- [ ] 2.4 setting.html sticky-nav 改為：`.nav-title` + `.nav-close-btn`（X → index.html）

## 3. CSS 統一

- [ ] 3.1 shared.css 新增 `.nav-title` 樣式（`--fs-lg`、`font-weight: 700`、`flex: 1`、`overflow: hidden`、`text-overflow: ellipsis`）
- [ ] 3.2 shared.css 新增 `.nav-close-btn` 樣式（與 `.nav-action-btn` 共用基底）
- [ ] 3.3 shared.css `:root` 新增 `--accent-lighter: #F9F3EF`，`body.dark` 新增 `--accent-lighter: #252220`
- [ ] 3.4 style.css `.day-overview` background 改為 `var(--accent-lighter)`
- [ ] 3.5 style.css 列印模式和 `@media print` 補上 `--accent-lighter` 定義
- [ ] 3.6 edit.css 移除 `.dh-menu` 相關樣式和桌機隱藏規則，移除舊 `.nav-title` 定義（已搬至 shared.css）
- [ ] 3.7 setting.css 移除 `.dh-menu` 相關樣式和桌機隱藏規則

## 4. switchDay hash 更新

- [ ] 4.1 app.js `switchDay()` 末尾加 `history.replaceState(null, '', '#day' + dayId)`

## 5. 移除 highlights

- [ ] 5.1 app.js 刪除 `renderHighlights()` 函式
- [ ] 5.2 app.js `renderTrip` 中刪除 `sec-highlights` section 渲染
- [ ] 5.3 app.js `renderInfoPanel` 中刪除 highlights tags 區塊
- [ ] 5.4 app.js `validateTripData` 中移除 `highlights` 必填檢查
- [ ] 5.5 app.js module.exports 移除 `renderHighlights` 匯出（如有）
- [ ] 5.6 style.css 移除 `.highlight-tag` 等 highlights 相關 CSS
- [ ] 5.7 所有 `data/trips/*.json` 移除 `highlights` 欄位
- [ ] 5.8 `data/examples/template.json` 移除 `highlights` 欄位

## 6. suggestions 僅保留 Speed Dial

- [ ] 6.1 app.js `renderTrip` 中刪除 `sec-suggestions` section 渲染
- [ ] 6.2 app.js 刪除 `renderSuggestionSummaryCard()` 函式
- [ ] 6.3 app.js `renderInfoPanel` 中移除 `renderSuggestionSummaryCard` 呼叫
- [ ] 6.4 app.js module.exports 移除 `renderSuggestionSummaryCard` 匯出

## 7. 測試更新

- [ ] 7.1 tests/setup.js 確認 menu.js require 已移除、無 menu 相關 global
- [ ] 7.2 unit tests 移除 `renderHighlights` 相關測試
- [ ] 7.3 unit tests 移除 `renderSuggestionSummaryCard` 相關測試
- [ ] 7.4 E2E edit-page.spec.js 移除漢堡選單/桌機側邊欄測試區段
- [ ] 7.5 E2E edit-page.spec.js 新增 X 關閉鈕測試（點擊 → 導向 index.html）
- [ ] 7.6 E2E trip-page.spec.js 移除 `sec-highlights` 存在性測試
- [ ] 7.7 E2E trip-page.spec.js 移除 `sec-suggestions` 存在性測試
- [ ] 7.8 JSON schema/quality tests 移除 highlights 相關驗證
- [ ] 7.9 確認所有測試通過
