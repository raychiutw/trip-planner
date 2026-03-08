## MODIFIED Requirements

### Requirement: Bottom Sheet 內容
Bottom Sheet 的 `#bottomSheetBody` SHALL 由 `openSpeedDialContent()` 動態渲染 Speed Dial 按鈕對應的內容。支援的 contentKey 為：flights、checklist、backup、emergency、suggestions、driving。

#### Scenario: Speed Dial 開啟 driving 內容
- **WHEN** 使用者點擊 Speed Dial 的 driving 按鈕
- **THEN** Bottom Sheet 開啟並顯示全旅程交通統計內容（由 `renderTripDrivingStats` 渲染）

#### Scenario: Speed Dial 開啟其他輔助內容
- **WHEN** 使用者點擊 Speed Dial 的 flights/checklist/backup/emergency/suggestions 按鈕
- **THEN** Bottom Sheet 開啟並顯示對應內容（行為不變）

#### Scenario: 資料尚未載入時顯示空狀態
- **WHEN** 使用者在資料載入前點擊 Speed Dial 按鈕
- **THEN** Bottom Sheet 顯示「無相關資料」提示文字

### Requirement: 輔助內容僅透過 Bottom Sheet 存取
所有輔助內容（flights、checklist、backup、emergency、suggestions、driving）SHALL NOT 直接渲染於主頁面 DOM。主頁面 SHALL 僅包含每日行程區塊與 Footer。輔助內容 SHALL 僅透過 Speed Dial → Bottom Sheet 存取。

#### Scenario: 主頁面不包含 info slot
- **WHEN** 行程載入完成
- **THEN** DOM 中 SHALL NOT 存在 `#flights-slot`、`#checklist-slot`、`#backup-slot`、`#emergency-slot`、`#suggestions-slot`、`#driving-slot`

#### Scenario: 輔助資料以 cache 方式暫存
- **WHEN** fetch 取得輔助內容 JSON
- **THEN** SHALL 將資料存入 `TRIP[key]`（cache）供 Bottom Sheet 讀取
- **AND** SHALL NOT 嘗試渲染至主頁面 DOM

### Requirement: driving 內容支援
`DIAL_RENDERERS` SHALL 包含 `driving: renderTripDrivingStats` 映射。driving 資料 SHALL 在所有 day 載入完成後計算並存入 `TRIP.driving`。

#### Scenario: 所有 day 載入後 driving 資料可用
- **WHEN** 所有 day JSON 載入完成
- **THEN** `TRIP.driving` SHALL 包含 `{ title, content }` 結構
- **AND** Speed Dial driving 按鈕點擊後 SHALL 在 Bottom Sheet 顯示交通統計

#### Scenario: 非自駕行程無 driving 資料
- **WHEN** 行程無交通統計資料（`calcTripDrivingStats` 回傳 falsy）
- **THEN** `TRIP.driving` SHALL NOT 被設定
- **AND** Speed Dial driving 按鈕點擊後顯示「無相關資料」
