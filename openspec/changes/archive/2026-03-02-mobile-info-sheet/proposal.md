## Why

手機版（<768px）目前完全看不到 info-panel（倒數計時、行程統計、建議摘要），因為 info-panel 只在桌機版（≥1200px）顯示於右側欄。新增 ℹ FAB 按鈕與 Bottom Sheet，讓手機用戶也能快速查閱這些資訊，無需進選單或捲動頁面。

## What Changes

- 在 `index.html` 新增 ℹ FAB 按鈕（位於現有 ＋ FAB 上方），僅手機版（<768px）可見
- 在 `index.html` 新增 Bottom Sheet 容器 HTML（backdrop + sheet 面板 + drag handle）
- 在 `css/style.css` 新增 ℹ FAB 定位樣式（堆疊於 ＋ FAB 上方，間距 12px）
- 在 `css/style.css` 新增 Bottom Sheet 樣式（slide-up 動畫、backdrop fade、最大高度 70vh、內部捲動）
- 在 `js/app.js` 新增 Bottom Sheet 開關邏輯（點擊 ℹ FAB 開啟、點擊 backdrop 或下滑關閉）
- 在 `js/app.js` 修改 `renderInfoPanel()`，同時渲染內容到 Bottom Sheet 內容區
- 在 `js/icons.js` 新增 `info` icon 到 ICONS registry（Material Symbols Rounded 的 info 圖示）

## Capabilities

### New Capabilities
- `info-fab-button`: 手機版 ℹ FAB 按鈕，固定顯示於畫面右下角 ＋ FAB 上方，點擊後開啟 Bottom Sheet
- `info-bottom-sheet`: Bottom Sheet 面板，從畫面底部滑入，包含倒數計時、行程統計、建議摘要三張卡片，支援 backdrop 點擊關閉與下滑手勢關閉

### Modified Capabilities
- （無現有 spec 層級需求變更）

## Impact

- `index.html`：新增 ℹ FAB 按鈕 HTML、Bottom Sheet container HTML
- `css/style.css`：新增 FAB stack 定位規則、Bottom Sheet 動畫與覆層樣式
- `js/app.js`：新增 Bottom Sheet 控制邏輯、修改 `renderInfoPanel()` 渲染目標
- `js/icons.js`：新增 `info` icon SVG 至 ICONS registry
- 不影響 JSON 資料結構，無 checklist/backup/suggestions 連動異動
- 不影響桌機版 info-panel 顯示行為
