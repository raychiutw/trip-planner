## MODIFIED Requirements

### Requirement: 選擇行程
從 `data/trips.json` 讀取行程清單。每個行程渲染為 `.trip-btn` 按鈕，顯示行程名稱、日期、owner。選中項目 SHALL 加 `.active` 樣式，使用均勻的 `box-shadow` 外框（四邊等粗）。點擊後存入 `localStorage trip-pref`（slug 格式），並 SHALL 自動導向 `index.html` 載入該行程。無預設選中時，自動選第一筆。

#### Scenario: 行程卡片選中外框均勻
- **WHEN** 使用者選中一個行程卡片
- **THEN** 該卡片 SHALL 顯示四邊等粗的選中外框（`box-shadow`），不使用 `border-left`

#### Scenario: 選擇行程後跳轉
- **WHEN** 使用者點擊一個行程卡片
- **THEN** 系統 SHALL 存入 `localStorage trip-pref` 並自動導向 `index.html`

## ADDED Requirements

### Requirement: 設定頁隱藏 sticky-nav
設定頁（setting.html）SHALL 隱藏 `.sticky-nav` 元素，不論螢幕尺寸（手機與桌機皆隱藏）。

#### Scenario: 設定頁無 sticky-nav 色帶
- **WHEN** 使用者開啟 setting.html
- **THEN** 頁面 SHALL 不顯示 `.sticky-nav` 元素（無頂部色帶）
