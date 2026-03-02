## ADDED Requirements

### Requirement: Bottom Sheet 結構
`index.html` SHALL 包含 Bottom Sheet 容器，結構為：backdrop 遮罩層 + sheet 面板（含 drag handle 拉桿指示器 + 內容捲動區）。所有元素 SHALL 以固定定位（`position: fixed`）覆蓋畫面。

#### Scenario: Bottom Sheet HTML 結構正確
- **WHEN** index.html 載入完成
- **THEN** DOM 中存在 `#infoBottomSheet`（backdrop）、`#infoSheet`（sheet 面板）、`.sheet-handle`（拉桿）、`#bottomSheetBody`（內容區）

### Requirement: Bottom Sheet 開啟動畫
Bottom Sheet 開啟時 SHALL 執行 slide-up 動畫（`transform: translateY(100%)` → `translateY(0)`，`transition: 0.3s ease`），backdrop 同時執行 fade-in（`opacity: 0` → `1`）。

#### Scenario: 點擊 ℹ FAB 後動畫播放
- **WHEN** 使用者點擊 ℹ FAB
- **THEN** sheet 面板從畫面底部滑入，backdrop 淡入，動畫時長約 300ms

### Requirement: Bottom Sheet 關閉方式
使用者 SHALL 能透過以下任一方式關閉 Bottom Sheet：
1. 點擊 backdrop 遮罩區域
2. 在 sheet 面板上向下滑動超過 60px（touchstart → touchend deltaY > 60）

#### Scenario: 點擊 backdrop 關閉
- **WHEN** Bottom Sheet 開啟狀態下，使用者點擊 backdrop 遮罩
- **THEN** Bottom Sheet 執行 slide-down 動畫後隱藏，backdrop fade-out

#### Scenario: 向下滑動關閉
- **WHEN** Bottom Sheet 開啟狀態下，使用者在 sheet 上向下滑動超過 60px
- **THEN** Bottom Sheet 關閉

### Requirement: Bottom Sheet 內容
Bottom Sheet 的 `#bottomSheetBody` SHALL 包含與 `#infoPanel` 相同的三張卡片：倒數計時卡（`renderCountdown`）、行程統計卡（`renderTripStatsCard`）、建議摘要卡（`renderSuggestionSummaryCard`）。

#### Scenario: Bottom Sheet 顯示完整 info 內容
- **WHEN** Bottom Sheet 開啟
- **THEN** 內容區顯示倒數計時、行程統計、建議摘要三張卡片，內容與桌機版 info-panel 一致

### Requirement: Bottom Sheet 高度限制與捲動
Bottom Sheet 面板最大高度 SHALL 為 `70vh`，超過內容量時 SHALL 允許內部捲動（`overflow-y: auto`）。

#### Scenario: 內容超出 70vh 時可捲動
- **WHEN** Bottom Sheet 內容高度超過 70vh
- **THEN** sheet 面板固定在 70vh，使用者可在面板內部向上捲動查看更多內容

### Requirement: Bottom Sheet 僅手機版啟用
Bottom Sheet 及 ℹ FAB 的開關行為 SHALL 僅在手機版（<768px）生效；桌機版（≥768px）ℹ FAB 隱藏，Bottom Sheet 不應可見。

#### Scenario: 桌機版 Bottom Sheet 不可觸發
- **WHEN** 使用者在 ≥768px 寬度裝置操作
- **THEN** Bottom Sheet 不顯示，info-panel 照常顯示於右側欄

### Requirement: 深色模式適配
Bottom Sheet 的 sheet 面板背景色 SHALL 使用 `var(--card-bg)` CSS 變數，以自動適配深色模式（`body.dark`）。

#### Scenario: 深色模式下 Bottom Sheet 外觀正確
- **WHEN** 使用者在深色模式下開啟 Bottom Sheet
- **THEN** sheet 面板背景色使用深色主題的卡片背景色，不顯示白色背景

### Requirement: renderInfoPanel 同時渲染兩個目標
`js/app.js` 的 `renderInfoPanel(data)` 函式 SHALL 同時渲染 HTML 至 `#infoPanel`（桌機版右側欄）和 `#bottomSheetBody`（Bottom Sheet 內容區），當目標元素不存在時 SHALL 略過該目標（null 檢查）。移除原本對 `offsetParent === null` 的早返回邏輯。

#### Scenario: 行程載入後 Bottom Sheet 內容就緒
- **WHEN** index.html 行程資料載入完成
- **THEN** `#bottomSheetBody` 已填入 info-panel 三張卡片的 HTML，無需等待使用者點擊 ℹ FAB
