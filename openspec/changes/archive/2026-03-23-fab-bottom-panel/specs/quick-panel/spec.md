## ADDED Requirements

### Requirement: QuickPanel Bottom Sheet 結構
系統 SHALL 提供 `QuickPanel` 元件，以 iOS Action Sheet 風格從畫面底部滑入，取代現行 SpeedDial 垂直展開。QuickPanel 結構為：backdrop 遮罩 + sheet 面板（含 drag handle + grid 內容區）。

#### Scenario: QuickPanel DOM 結構正確
- **WHEN** TripPage 載入完成
- **THEN** DOM 中存在 `.quick-panel`（root）、`.quick-panel-backdrop`（backdrop）、`.quick-panel-sheet`（面板）、`.sheet-handle`（拉桿）、`.quick-panel-grid`（grid 區）

### Requirement: QuickPanel Grid 排版
QuickPanel 內容區 SHALL 以 `grid-template-columns: repeat(4, 1fr)` 排列 14 個項目，分為三個區段：行程資訊（4 格）+ 行程工具與快捷設定（6 格，兩行各 3）+ 分隔線 + 下載匯出（4 格）。每格 SHALL 包含一個 Icon 和一個 label，min-height 為 `var(--tap-min)`。

#### Scenario: Grid 項目數量和順序正確
- **WHEN** QuickPanel 展開
- **THEN** grid 內 SHALL 依序顯示：航班、出發、緊急、備案、建議、路線、交通、（空）、切換行程、外觀主題、列印、（空）、分隔線、PDF、Markdown、JSON、CSV

#### Scenario: 每格觸控目標 ≥ 44px
- **WHEN** 在 390px 手機 viewport 測量 grid 每格
- **THEN** 每格高度 SHALL ≥ 44px（`var(--tap-min)`）

### Requirement: QuickPanel 項目定義
QuickPanel SHALL 包含以下 14 個項目，每項有 key、icon（ICONS registry）、label、action type：

| key | icon | label | action |
|-----|------|-------|--------|
| flights | plane | 航班 | sheet |
| checklist | check-circle | 出發 | sheet |
| emergency | emergency | 緊急 | sheet |
| backup | backup | 備案 | sheet |
| suggestions | lightbulb | 建議 | sheet |
| today-route | route | 路線 | sheet |
| driving | car | 交通 | sheet |
| trip-select | swap-horiz | 行程 | drill-down |
| appearance | palette | 外觀 | drill-down |
| printer | printer | 列印 | print |
| download-pdf | download | PDF | download |
| download-md | doc | MD | download |
| download-json | code | JSON | download |
| download-csv | table | CSV | download |

#### Scenario: 每個項目只有一個 label
- **WHEN** 檢查 QuickPanel 的每個 grid item DOM
- **THEN** 每個 button 內 SHALL 只包含一個 `.svg-icon` 和一個 label text node，不得重複

### Requirement: FAB 觸發按鈕
FAB 觸發按鈕 SHALL 維持 fixed 定位於畫面右下角（`bottom: max(88px, calc(68px + env(safe-area-inset-bottom)))`，`right: 20px`）。圖示 SHALL 為朝上三角形（收折）/ 朝下三角形（展開），透過 `transform: rotate(180deg)` + `var(--transition-timing-function-apple)` 動畫切換。

#### Scenario: FAB 收折時顯示向上箭頭
- **WHEN** QuickPanel 為關閉狀態
- **THEN** FAB 按鈕內的 SVG 箭頭 SHALL 朝上（指示「往上拉出面板」）

#### Scenario: FAB 展開時顯示向下箭頭
- **WHEN** QuickPanel 為展開狀態
- **THEN** FAB 按鈕內的 SVG 箭頭 SHALL 朝下（透過 180° 旋轉），動畫使用 Apple spring easing

### Requirement: QuickPanel 開啟/關閉動畫
QuickPanel 開啟時 SHALL 執行 slide-up 動畫（`translateY(100%) → translateY(0)`，`var(--transition-duration-slow)` + `var(--transition-timing-function-apple)`），backdrop 同時 fade-in。關閉時反向。

#### Scenario: 開啟動畫播放
- **WHEN** 使用者點擊 FAB
- **THEN** sheet 從底部滑入，backdrop 淡入，動畫約 350ms

#### Scenario: 關閉動畫播放
- **WHEN** 使用者關閉 QuickPanel
- **THEN** sheet 向底部滑出，backdrop 淡出

### Requirement: QuickPanel 關閉方式
使用者 SHALL 能透過以下方式關閉 QuickPanel：
1. 點擊 backdrop
2. 按 Escape 鍵（焦點回到 FAB 按鈕）
3. 點擊 grid 項目（執行動作後自動關閉）

#### Scenario: 點擊 backdrop 關閉
- **WHEN** QuickPanel 開啟狀態下點擊 backdrop
- **THEN** QuickPanel 關閉

#### Scenario: Escape 鍵關閉並回焦
- **WHEN** QuickPanel 開啟狀態下按 Escape
- **THEN** QuickPanel 關閉且焦點 SHALL 回到 FAB 按鈕

### Requirement: Sheet-in-sheet drill-down（切換行程）
點擊「切換行程」grid 項目時，QuickPanel 內容區 SHALL 以左右滑動動畫切換為行程列表視圖，顯示所有已發布行程供選擇。頂部 SHALL 有「← 返回」按鈕和「選擇行程」標題。

#### Scenario: 行程列表顯示所有已發布行程
- **WHEN** 使用者點擊「切換行程」
- **THEN** 內容區切換為行程列表，顯示所有 published=1 的行程，當前行程標記為選中狀態

#### Scenario: 選擇行程後切換並關閉
- **WHEN** 使用者在行程列表中點擊另一個行程
- **THEN** 系統 SHALL 切換至該行程（更新 URL + localStorage）並關閉 QuickPanel

#### Scenario: 返回按鈕回到 grid
- **WHEN** 使用者在行程列表視圖點擊「← 返回」
- **THEN** 內容區 SHALL 滑回 grid 主畫面

### Requirement: Sheet-in-sheet drill-down（外觀主題）
點擊「外觀主題」grid 項目時，QuickPanel 內容區 SHALL 切換為主題選擇器視圖，包含色彩模式（淺色/深色/自動）和 6 個主題色選擇。

#### Scenario: 主題選擇器顯示當前設定
- **WHEN** 使用者點擊「外觀主題」
- **THEN** 內容區顯示色彩模式切換（當前模式高亮）+ 6 個主題色按鈕（當前主題高亮）

#### Scenario: 切換主題即時生效
- **WHEN** 使用者在主題選擇器中點擊另一個主題
- **THEN** 主題 SHALL 即時套用（body class 更新 + localStorage 儲存），不關閉 QuickPanel

#### Scenario: 切換色彩模式即時生效
- **WHEN** 使用者切換色彩模式（淺色/深色/自動）
- **THEN** 模式 SHALL 即時套用，不關閉 QuickPanel

### Requirement: QuickPanel 下載匯出功能
分隔線下方 4 個下載按鈕（PDF/MD/JSON/CSV）SHALL 直接觸發對應的下載邏輯，不需開啟額外的 DownloadSheet。

#### Scenario: 點擊 PDF 觸發列印
- **WHEN** 使用者點擊 PDF 按鈕
- **THEN** 系統 SHALL 關閉 QuickPanel → 進入列印模式 → 呼叫 `window.print()`

#### Scenario: 點擊 MD/JSON/CSV 觸發下載
- **WHEN** 使用者點擊 MD、JSON 或 CSV 按鈕
- **THEN** 系統 SHALL 關閉 QuickPanel → 呼叫對應的 `handleDownloadFormat` → 瀏覽器下載檔案

### Requirement: 移除舊 SpeedDial 元件
完成 QuickPanel 後 SHALL 刪除 `SpeedDial.tsx` 及其對應的 CSS 規則（`.speed-dial-*`）。TripPage 中的 SpeedDial import 和使用 SHALL 替換為 QuickPanel。

#### Scenario: SpeedDial 不再存在
- **WHEN** 專案建置完成
- **THEN** `src/components/trip/SpeedDial.tsx` SHALL 不存在，所有 `.speed-dial-*` CSS 規則 SHALL 已移除

### Requirement: 移除 DownloadSheet 元件
下載功能已整合至 QuickPanel 下載區段，`DownloadSheet.tsx` 及其對應 CSS SHALL 移除。TripPage 中的 DownloadSheet import 和 state SHALL 移除。

#### Scenario: DownloadSheet 不再存在
- **WHEN** 專案建置完成
- **THEN** `src/components/trip/DownloadSheet.tsx` SHALL 不存在，TripPage 中不再有 `downloadOpen` state

### Requirement: QuickPanel 深色模式適配
QuickPanel 面板背景色 SHALL 使用 `var(--color-secondary)`，文字色使用 `var(--color-foreground)`，以自動適配深色模式。

#### Scenario: 深色模式下 QuickPanel 外觀正確
- **WHEN** 深色模式開啟時展開 QuickPanel
- **THEN** 面板背景 SHALL 使用深色主題的 secondary 色，icon 和文字 SHALL 清晰可讀

### Requirement: QuickPanel body scroll lock
QuickPanel 開啟時 SHALL 鎖定 body 捲動（`position: fixed` + 儲存/還原 scrollY），與 InfoSheet 相同機制。

#### Scenario: 開啟時頁面不可捲動
- **WHEN** QuickPanel 展開
- **THEN** body SHALL 被鎖定，使用者無法捲動背景頁面內容

#### Scenario: 關閉時頁面恢復捲動位置
- **WHEN** QuickPanel 關閉
- **THEN** body scroll lock SHALL 解除，頁面回到開啟前的捲動位置

### Requirement: QuickPanel 列印模式隱藏
QuickPanel 的 FAB 按鈕和面板 SHALL 在 `@media print` 下隱藏（`display: none !important`）。

#### Scenario: 列印時不顯示 QuickPanel
- **WHEN** 頁面進入列印模式
- **THEN** FAB 按鈕和 QuickPanel 面板 SHALL 不出現在列印輸出
