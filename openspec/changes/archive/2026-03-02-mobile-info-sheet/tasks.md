## 1. icons.js — 新增 info icon

- [x]1.1 在 `js/icons.js` ICONS registry 的 UI System 區段新增 `'info'` key，使用 Material Symbols Rounded 的 info icon SVG path（viewBox 0 0 24 24，fill="currentColor"）

## 2. index.html — 新增 ℹ FAB 按鈕

- [x]2.1 在 `index.html` 現有 `<a class="edit-fab" id="editFab">` 元素之前，新增 `<button class="info-fab" id="infoFab" aria-label="行程資訊">` 按鈕，內容使用 `iconSpan('info')` 對應的 inline SVG（或直接 inline SVG，與 icons.js 一致）

## 3. index.html — 新增 Bottom Sheet 容器 HTML

- [x]3.1 在 `index.html` `<body>` 底部（FAB 元素之後）新增 Bottom Sheet 結構：
  - 外層 `<div id="infoBottomSheet" class="info-sheet-backdrop">`（backdrop 遮罩）
  - 內層 `<div id="infoSheet" class="info-sheet-panel">`（sheet 面板）
  - sheet 面板內含：`.sheet-handle`（拉桿指示器 div）+ `<div id="bottomSheetBody" class="info-sheet-body">`（內容捲動區）

## 4. css/style.css — ℹ FAB 樣式

- [x]4.1 新增 `.info-fab` 樣式：`position: fixed; bottom: 88px; right: 20px; width: 56px; height: 56px; border-radius: 50%; background: var(--blue); color: #fff; border: none; z-index: 300; box-shadow: 0 4px 12px rgba(0,0,0,0.2); display: none; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;`
- [x]4.2 新增 `.info-fab:hover` 樣式：`transform: scale(1.1); box-shadow: 0 6px 16px rgba(0,0,0,0.3);`
- [x]4.3 新增 `body.dark .info-fab` 深色模式背景色（`background: #C4704F;`）
- [x]4.4 新增 `.print-mode .info-fab` 與 `@media print { .info-fab }` 設定 `display: none !important;`
- [x]4.5 新增 `@media (max-width: 767px) { .info-fab { display: flex; } }` 讓 ℹ FAB 僅手機版顯示

## 5. css/style.css — Bottom Sheet 樣式

- [x]5.1 新增 `.info-sheet-backdrop` 樣式：`position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 400; opacity: 0; pointer-events: none; transition: opacity 0.3s ease;`
- [x]5.2 新增 `.info-sheet-backdrop.open` 樣式：`opacity: 1; pointer-events: auto;`
- [x]5.3 新增 `.info-sheet-panel` 樣式：`position: fixed; bottom: 0; left: 0; right: 0; max-height: 70vh; background: var(--card-bg); border-radius: 16px 16px 0 0; z-index: 401; transform: translateY(100%); transition: transform 0.3s ease; overflow-y: auto; padding: 12px 16px 24px;`
- [x]5.4 新增 `.info-sheet-backdrop.open .info-sheet-panel` 樣式：`transform: translateY(0);`
- [x]5.5 新增 `.sheet-handle` 樣式：`width: 40px; height: 4px; background: var(--gray-light); border-radius: 2px; margin: 0 auto 16px; cursor: grab;`
- [x]5.6 新增 `.info-sheet-body` 樣式：`overflow-y: auto;`（供內容區使用）

## 6. js/app.js — Bottom Sheet 開關邏輯

- [x]6.1 新增 `openInfoSheet()` 函式：為 `#infoBottomSheet` 加上 `.open` class
- [x]6.2 新增 `closeInfoSheet()` 函式：從 `#infoBottomSheet` 移除 `.open` class
- [x]6.3 在頁面初始化後，為 `#infoFab` 綁定 `click` 事件，呼叫 `openInfoSheet()`
- [x]6.4 為 `#infoBottomSheet`（backdrop）綁定 `click` 事件，點擊 backdrop（非 sheet panel 內部）時呼叫 `closeInfoSheet()`；阻止 sheet panel 點擊事件冒泡至 backdrop
- [x]6.5 為 `#infoSheet` 綁定 `touchstart` / `touchend` 事件：記錄 `touchstart` 的 `clientY`，`touchend` 時若 `deltaY > 60`（向下滑）則呼叫 `closeInfoSheet()`

## 7. js/app.js — 修改 renderInfoPanel()

- [x]7.1 移除 `renderInfoPanel()` 中 `if (panel.offsetParent === null && panel.offsetWidth === 0) return;` 的早返回邏輯
- [x]7.2 修改 `renderInfoPanel()` 中渲染邏輯：若 `panel`（`#infoPanel`）存在則渲染（維持桌機原有行為，不限制 visibility 判斷）；另以 `document.getElementById('bottomSheetBody')` 取得 Bottom Sheet 內容區，若不為 null 則同樣渲染相同 HTML

## 8. 測試更新

- [x]8.1 在 `tests/unit/` 新增或更新 unit test：驗證 `renderCountdown`、`renderTripStatsCard`、`renderSuggestionSummaryCard` 的回傳 HTML 字串不為空（若尚無對應測試）
- [x]8.2 在 `tests/e2e/trip-page.spec.js` 新增 E2E 測試：在手機 viewport（375×667）下，點擊 ℹ FAB 後驗證 Bottom Sheet 的 `.info-sheet-backdrop.open` class 存在
- [x]8.3 在 `tests/e2e/trip-page.spec.js` 新增 E2E 測試：Bottom Sheet 開啟後點擊 backdrop，驗證 `.open` class 消失
