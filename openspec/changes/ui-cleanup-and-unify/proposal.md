## Why

三頁（index / edit / setting）的導航架構不一致：index 已改為 Speed Dial + tab 切換，但 edit/setting 仍保留 sidebar + drawer 舊架構。此外存在多個 UI 問題——概況區與子元件底色撞色、Day tab 切換不更新 URL hash、highlights 功能價值低佔版面、suggestions 在主頁和 Speed Dial 重複渲染。需一次性統一清理。

## What Changes

- **移除 sidebar/drawer 系統**：edit.html、setting.html 移除 `<aside class="sidebar">`、`#menuDrop`、`#menuBackdrop`，改為 sticky-nav 右上角 X 關閉鈕（→ index.html）
- **刪除 menu.js**：全站不再有 sidebar/drawer，整個檔案移除。三頁 HTML 移除 `<script src="js/menu.js">`
- **刪除 menu.css**：sidebar/drawer/hamburger 樣式全部移除，sticky-nav 共用樣式合併至 shared.css
- **清除 app.js 殘留**：移除 `buildMenu()`、`closeMobileMenuIfOpen()` 呼叫、menu.js 依賴註解
- **三頁 header 統一**：edit/setting 標題改用 `--fs-lg` + `font-weight: 700`，共用 sticky-nav 基底樣式
- **概況區底色調淺**：新增 CSS 變數 `--accent-lighter`（淺色 `#F9F3EF` / 深色 `#252220`），`.day-overview` 改用此色，與子元件 `--accent-light` 區分層次
- **switchDay 更新 URL hash**：點擊 pill 時 `history.replaceState` 寫入 `#dayN`，支援分享與重整保留
- **移除 highlights**：刪除 `renderHighlights()` 函式、主頁面 `sec-highlights` section、info panel 標籤雲、行程 JSON 中的 `highlights` 欄位、相關測試與 schema 驗證
- **suggestions 僅保留 Speed Dial**：移除主頁面 `sec-suggestions` section 與 info panel `renderSuggestionSummaryCard()`，Speed Dial → bottom sheet 為唯一入口

## Capabilities

### New Capabilities
- `close-button-nav`: edit/setting 頁面 X 關閉鈕導航回 index
- `accent-lighter-color`: 新增 `--accent-lighter` CSS 變數用於概況區底色

### Modified Capabilities

（無既有 spec 需修改）

## Impact

- **HTML**：edit.html、setting.html（結構大改）、index.html（移除 menu.js 引用）
- **CSS**：menu.css（刪除）、shared.css（合併 sticky-nav 樣式、新增 --accent-lighter）、style.css（day-overview 底色、移除 highlights/suggestions CSS）、edit.css（移除 .dh-menu 相關、更新 .nav-title）、setting.css（同上）
- **JS**：menu.js（刪除）、app.js（移除 buildMenu、renderHighlights、renderSuggestionSummaryCard、closeMobileMenuIfOpen 呼叫、switchDay 加 hash）、edit.js（移除 buildPageNav 呼叫）、setting.js（同上）
- **JSON**：所有 `data/trips/*.json` 移除 `highlights` 欄位；`data/examples/template.json` 同步更新
- **Tests**：unit tests 移除 highlights/suggestionSummary 相關、E2E edit-page.spec.js 移除 sidebar/drawer 測試並加 X 鈕測試、setup.js 可能需調整
