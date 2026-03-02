# Spec: setting-page

設定頁面，提供行程切換與色彩模式設定。

## 頁面結構

- **URL**: `setting.html`
- **載入**: `shared.css` + `menu.css` + `setting.css` + `shared.js` + `menu.js` + `icons.js` + `setting.js`
- **CSP**: `connect-src 'self'`（不需 GitHub API）

## 區段一：選擇行程

- 從 `data/trips.json` 讀取行程清單
- 每個行程渲染為 `.trip-btn` 按鈕，顯示行程名稱、日期、owner
- 選中項目加 `.active` 樣式（左側 `#C4704F` 邊框 + box-shadow）
- 點擊後存入 `localStorage trip-pref`（slug 格式），頁面即時更新 UI
- 無預設選中時，自動選第一筆

## 區段二：外觀（色彩模式）

- 三選一卡片：Light（淺色）/ Auto（自動）/ Dark（深色）
- 三欄 grid 排列，每張卡片含色彩預覽縮圖 + 標籤
- Auto 預覽使用 135° 對角線漸層模擬半淺半深
- 選中卡片加 `#C4704F` 邊框
- 點擊存入 `localStorage color-mode`，即時套用

## 色彩模式邏輯

- `applyColorMode(mode)` 根據 mode 切換 `body.dark` class
- `auto` 模式透過 `window.matchMedia('(prefers-color-scheme: dark)')` 判斷
- 更新 `meta[name="theme-color"]` 值（dark: `#7D4A36`, light: `#C4704F`）

## 舊版相容

- 若 `localStorage color-mode` 未設定，檢查舊版 `localStorage dark` 標記
- `lsGet('dark') === '1'` 視為 dark 模式
