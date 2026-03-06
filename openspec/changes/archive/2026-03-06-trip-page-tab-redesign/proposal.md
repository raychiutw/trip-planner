## Why

行程頁（index.html）目前以垂直長頁面捲動方式呈現所有天數與資訊區塊，導致行程天數多時頁面過長、掃讀困難。導航方式依賴 sidebar + nav pills anchor scroll，存在以下痛點：

1. **sidebar 佔空間但使用率低**：sidebar 選單項目與功能跳轉混合，多數使用者只用天數切換
2. **nav pills 標籤 "D1 D2 D3" 佔字元**：前綴 "D" 浪費空間，桌機版缺乏品牌標識
3. **資訊區塊（航班/清單/備案/緊急/建議）散落頁面底部**：需大量捲動才能到達
4. **手機版 ℹ FAB 只顯示統計**：航班/清單等非天數內容缺乏快速入口

## What Changes

### 天數切換改為 Tab 模式
- 行程主體從垂直長頁面改為**一次顯示一天**（CSS `display` 切換）
- 所有天數 HTML 同時渲染，透過 `.active` class 切換顯示的天
- Nav pills 標籤從 "D1" 改為 "1"（純數字），桌機版前方加 "Trip Planner" 文字

### Sidebar 完全移除
- **桌機版**：移除左側 sidebar，設定（⚙）與列印模式（🖨）以 icon+文字 形式移至 sticky-nav 右側
- **手機版**：移除 drawer sidebar，設定與列印模式以純 icon 形式移至 sticky-nav 右側
- 原 sidebar 中的功能跳轉項目（航班/清單/備案/緊急/建議）移至 Speed Dial FAB

### Speed Dial FAB
- 現有 ℹ FAB 改為 Speed Dial 觸發器，icon 改為 ▲ 三角形（展開後變 ▼）
- 點擊展開 5 個子項目（由下往上排列）：✈ 航班 / ✓ 清單 / 🔄 備案 / 🚨 緊急 / 💡 建議
- 點擊子項目 → 開啟 Bottom Sheet 顯示對應內容
- 點擊 backdrop 或 ▼ 關閉 Speed Dial
- 桌機與手機版皆啟用 Speed Dial（桌機版 info-panel 保留）

### 手機版 Nav 配置（方案 A）
- pill 區域可橫向捲動（保留現有箭頭機制）
- 🖨 與 ⚙ 固定在 sticky-nav 最右側，不隨 pill 捲動

### 列印模式
- 列印模式行為不變：所有天數展開、隱藏 FAB/nav，全頁垂直排版

## Capabilities

### New Capabilities
- `tab-day-switching`: 天數 Tab 切換模式（一次顯示一天，CSS display 切換，pills 純數字標籤）
- `speed-dial-fab`: Speed Dial FAB 按鈕群組（▲/▼ 觸發器 + 5 個子項目 + Bottom Sheet 整合）
- `nav-action-icons`: sticky-nav 右側設定/列印 icon 按鈕（取代 sidebar 導航功能）

### Modified Capabilities
- `unified-menu`: 移除 sidebar/drawer 選單結構，功能跳轉項目改由 Speed Dial 承載
- `nav-pills-layout`: pills 標籤從 "D1" 改為 "1"，桌機版加 "Trip Planner" 前綴文字
- `info-fab-button`: ℹ FAB 改為 Speed Dial 觸發器，icon 改為三角形
- `info-bottom-sheet`: Bottom Sheet 改為由 Speed Dial 子項目觸發，內容依選擇的項目動態切換
- `desktop-layout`: 移除 sidebar 欄位，改為雙欄佈局（content + info-panel）

## Impact

### 檔案影響範圍
- **HTML**: `index.html`（移除 sidebar、修改 nav 結構、修改 FAB、新增 Speed Dial 結構）
- **CSS**: `css/style.css`（tab 切換、speed dial 動畫）、`css/menu.css`（移除 sidebar/drawer 樣式）、`css/shared.css`（可能的佈局變更）
- **JS**: `js/app.js`（tab 切換邏輯、speed dial 互動、nav pills 產生、buildMenu 重構）、`js/menu.js`（移除 sidebar/drawer 邏輯）
- **JSON**: 無 JSON 結構變更

### 不影響
- `edit.html` / `setting.html`：這兩頁各自有獨立的選單與 sidebar，本次不修改
- `data/trips/*.json`：行程資料結構不變
- checklist / backup / suggestions 連動：無影響
