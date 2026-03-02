## Context

目前 `index.html` 的 `info-panel` 僅在桌機版（≥1200px）透過 CSS 顯示，手機版完全看不到倒數計時、行程統計、建議摘要。`renderInfoPanel()` 在 `js/app.js` 中判斷 `panel.offsetParent === null` 時直接 return，導致手機端資料根本不渲染。

現有 FAB 架構：`<a class="edit-fab" id="editFab">` 固定於右下角 `bottom: 20px; right: 20px`，`z-index: 300`。三個 render 函式（`renderCountdown`、`renderTripStatsCard`、`renderSuggestionSummaryCard`）已回傳 HTML 字串，可直接複用。

## Goals / Non-Goals

**Goals:**
- 手機版（<768px）新增 ℹ FAB 按鈕，堆疊於 ＋ FAB 上方
- 點擊 ℹ FAB 開啟 Bottom Sheet，顯示 info-panel 三張卡片內容
- Bottom Sheet 支援 backdrop 點擊關閉與向下滑動手勢關閉
- 桌機版（≥768px）ℹ FAB 隱藏，info-panel 照常顯示

**Non-Goals:**
- 不新增 drag-to-resize 功能（只有向下滑關閉）
- 不修改 edit.html、setting.html
- 不變更行程 JSON 結構
- 不實作 Bottom Sheet 拖曳調整高度

## Decisions

### 1. ℹ FAB 定位方式：CSS `bottom` 偏移堆疊

**決定**：ℹ FAB 使用 `bottom: 88px`（56px FAB + 20px 底部間距 + 12px 間距），固定於 ＋ FAB 正上方，共用 `right: 20px`。

**替代方案**：用 flexbox column 容器包兩個 FAB — 複雜度高，需改動 HTML 結構，且動畫可能干擾現有 ＋ FAB 行為。

**選擇原因**：最小侵入性，只要新增一個獨立元素，不改現有 `.edit-fab` HTML/CSS。

### 2. Bottom Sheet 開關：CSS class toggle + transform

**決定**：Bottom Sheet 預設 `transform: translateY(100%)`（隱藏於畫面下方），開啟時加 `.open` class 改為 `transform: translateY(0)`，搭配 `transition: transform 0.3s ease`。Backdrop 使用 `opacity: 0 → 1` 的 fade transition。

**替代方案**：`display: none / block` 切換 — 無法做 slide-up 動畫。

**選擇原因**：純 CSS transition 效能佳，不需 requestAnimationFrame，且符合現有 menu drawer 的實作慣例。

### 3. Bottom Sheet 內容渲染時機

**決定**：在 `renderInfoPanel()` 中，移除對 `offsetParent === null` 的早返回判斷，改為同時渲染至 `#infoPanel`（桌機）和 `#bottomSheetBody`（手機 Bottom Sheet）兩個目標。

**替代方案**：僅在使用者點擊 ℹ FAB 時才渲染（lazy render）— 首次開啟有小延遲，且需要在事件處理器中存取 `data`。

**選擇原因**：行程資料已在頁面初始化時完整載入，同步渲染不增加效能負擔，且可確保 Bottom Sheet 開啟時立即顯示內容。

### 4. 向下滑動關閉（touch gesture）

**決定**：監聽 `touchstart` + `touchend` 事件，計算 deltaY；若向下滑超過 60px 則關閉 Bottom Sheet。不實作拖曳中的即時跟隨效果（too complex）。

**替代方案**：不支援手勢，只靠 backdrop 點擊 — 操作體驗差，手機用戶習慣下滑關閉。

**選擇原因**：簡單的 touchstart/touchend 判斷足以提供良好體驗，程式碼量小且不依賴外部套件。

### 5. info icon 加入 ICONS registry

**決定**：在 `js/icons.js` 的 ICONS registry UI System 區段新增 `'info'` key，使用 Material Symbols Rounded 的 info icon SVG path。

**替代方案**：直接在 HTML 中 inline SVG — 違反全站 inline SVG 集中管理規範，且無法由 `iconSpan()` 統一渲染。

## Risks / Trade-offs

- **[風險] Bottom Sheet 與現有 drawer 選單層級衝突** → 設定 Bottom Sheet `z-index: 400`（高於 FAB 的 300，低於 drawer 的 500）
- **[風險] Bottom Sheet 在極短螢幕（<500px 高）時超過 70vh 仍顯示不完整** → 設定 `overflow-y: auto` 允許內部捲動，使用者可滾動查看
- **[風險] `renderInfoPanel()` 同時渲染兩個目標，若 `#bottomSheetBody` 不存在（其他頁面）會出錯** → 以 `document.getElementById('bottomSheetBody')` 做 null 檢查，若不存在則略過
- **[Trade-off] 桌機版 ℹ FAB 完全隱藏** → 桌機版已有 info-panel 顯示，用戶不需要 FAB；若未來需要，可擴充 media query

## Migration Plan

1. 在 `js/icons.js` 新增 `info` icon
2. 在 `index.html` 新增 ℹ FAB 按鈕與 Bottom Sheet HTML
3. 在 `css/style.css` 新增對應樣式
4. 在 `js/app.js` 修改 `renderInfoPanel()` 並新增 Bottom Sheet 控制邏輯
5. 執行測試確認通過後 commit

無 rollback 複雜度，所有變更均為新增（HTML element + CSS rules + JS functions），不刪除或修改現有功能。
