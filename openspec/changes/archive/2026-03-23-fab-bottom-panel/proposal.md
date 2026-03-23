## Why

現行 SpeedDial 以垂直堆疊方式在螢幕右側展開 8 個按鈕，手機版遮擋 Mapcode / 交通資訊，標籤重複渲染（每項兩個 `<span>`），且「設定」按鈕還有巢狀子選單增加操作層級。同時 QC 稽核發現多項線上問題需一併修正。本次改版將 SpeedDial 全面重構為 iOS Action Sheet 風格的 Bottom Panel，並修復所有 QC 發現。

## What Changes

### A. FAB → Bottom Panel 重構

- **移除** 現行 SpeedDial 垂直展開邏輯（`SpeedDial.tsx` + 對應 CSS）
- **新增** `QuickPanel` 元件 — iOS Action Sheet 風格 Bottom Panel
  - 4 列 grid 排版：行程資訊（4）+ 行程工具（3）+ 快捷設定（3）+ 分隔線 + 下載匯出（4）
  - 共 14 個項目，扁平化無巢狀
- **移除** 原「設定」按鈕及其巢狀子選單，4 個子功能（切換行程 / 外觀主題 / 下載 / 列印）直接攤平至主 grid
- FAB 圖示從左右三角形（◀▶）改為上下箭頭（▲▼），搭配 180° rotate 動畫
- 「切換行程」改為 sheet-in-sheet drill-down 行程列表（不跳頁到 setting.html）
- 「外觀主題」改為 sheet-in-sheet 主題選擇器（不跳頁到 setting.html）

### B. 星夜主題取代深海

- **移除** `ocean` 主題（深藍色系，與 `sky` 太接近）
- **新增** `night` 主題（黑/炭灰色系）
  - 淺色模式：炭灰強調色 + 淺灰底
  - 深色模式：純黑底 + 微光灰點綴（OLED 友善）
- 設定頁主題選擇器對應更新

### C. QC 稽核問題修復

- **M1**：停車場地圖連結為空 — `mapDay.ts` 的 `buildLocation()` 需把地名作為 fallback query
- **M2**：URL `?trip=` 參數被 localStorage 覆蓋 — useTrip hook 應優先採用 URL 參數
- **M4**：預約連結觸控目標僅 23px — 調整為 ≥44px（`--tap-min`）
- **M5**：AeronAn + Onion 缺 emergency 文件 — 透過 API 補建文件資料
- **L4**：Sentry N+1 API Call — 調查前端迴圈呼叫，合併為批次請求

## Capabilities

### New Capabilities

- `quick-panel`: FAB 觸發的 iOS Action Sheet 風格 Bottom Panel，含 14 項 grid + sheet-in-sheet drill-down（行程選擇、主題切換）
- `night-theme`: 星夜主題色彩定義（取代深海），light/dark 雙模式

### Modified Capabilities

- `info-bottom-sheet`: Bottom Sheet 開關邏輯調整，QuickPanel 取代 SpeedDial 作為觸發入口
- `design-tokens`: 新增 night 主題色彩 token，移除 ocean 主題 token

## Impact

**前端元件**：
- `src/components/trip/SpeedDial.tsx` — 重構為 `QuickPanel.tsx`
- `src/components/trip/InfoSheet.tsx` — 開關邏輯微調
- `src/components/trip/DownloadSheet.tsx` — 整合至 QuickPanel 下載區
- `src/components/trip/MapLinks.tsx` — 修正停車場 URL 解析
- `src/hooks/useTrip.ts` — URL 參數優先權修正
- `src/pages/TripPage.tsx` — 替換 SpeedDial 為 QuickPanel
- `src/lib/mapDay.ts` — `buildLocation()` fallback 邏輯修正

**CSS**：
- `css/shared.css` — night 主題 token 定義、移除 ocean token
- `css/style.css` — QuickPanel 樣式、預約連結觸控目標、SpeedDial 樣式移除
- `css/setting.css` — 主題選擇器更新（ocean → night）

**設定頁**：
- `src/pages/SettingPage.tsx` — 主題列表更新
- `src/hooks/useDarkMode.ts` — ocean → night 映射

**資料**：
- AeronAn + Onion 行程需透過 API 補建 emergency 文件

**測試**：
- 現有 SpeedDial 相關測試需更新為 QuickPanel
- 新增 QuickPanel 開關 / grid 項目 / sheet-in-sheet 測試
- night 主題 token 測試
- 停車場地圖連結 / URL 參數優先權 unit test
