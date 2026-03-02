## MODIFIED Requirements

### Requirement: 選擇行程
- 從 `data/trips.json` 讀取行程清單
- 每個行程渲染為 `.trip-btn` 按鈕，顯示行程名稱、日期、owner
- 選中項目加 `.active` 樣式，使用 `border: 2px solid` 外框（四邊等粗），預設狀態 SHALL 使用 `border: 2px solid transparent` 佔位避免版面跳動
- 點擊後存入 `localStorage trip-pref`（slug 格式），並自動導向 `index.html`
- 無預設選中時，自動選第一筆

#### Scenario: active 邊框四邊等粗
- **WHEN** 使用者選中某個行程按鈕
- **THEN** 該按鈕 SHALL 顯示 2px solid 邊框（色值為 `var(--accent)`），四邊粗細完全一致

#### Scenario: 切換 active 不跳動
- **WHEN** 使用者從未選中狀態切換為選中狀態
- **THEN** 按鈕尺寸 SHALL 保持不變（transparent border 佔位）
