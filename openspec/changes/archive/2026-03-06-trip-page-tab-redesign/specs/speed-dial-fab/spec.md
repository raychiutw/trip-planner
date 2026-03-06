## ADDED Requirements

### Requirement: Speed Dial 觸發按鈕

畫面右下角 SHALL 顯示 Speed Dial 觸發按鈕，位於 ＋ FAB 正上方（間距 12px）。收合時顯示 ▲（向上三角形）inline SVG，展開時顯示 ▼（向下三角形）inline SVG。

#### Scenario: Speed Dial 按鈕初始狀態

- **WHEN** 行程頁載入完成
- **THEN** 右下角顯示 ▲ 按鈕，位於 ＋ FAB 正上方

#### Scenario: 展開時 icon 切換

- **WHEN** 使用者點擊 ▲ 按鈕展開 Speed Dial
- **THEN** 按鈕 icon 切換為 ▼

#### Scenario: 收合時 icon 切換

- **WHEN** 使用者關閉 Speed Dial
- **THEN** 按鈕 icon 切回 ▲

### Requirement: Speed Dial 子項目

Speed Dial 展開後 SHALL 從觸發按鈕上方依序向上排列 5 個圓形子項目按鈕。每個子項目包含 icon 與文字標籤。

子項目由下到上：
1. ✈ 航班（icon: `flight`）
2. ✓ 清單（icon: `checklist`）
3. 🔄 備案（icon: `refresh`）
4. 🚨 緊急（icon: `alert-circle`）
5. 💡 建議（icon: `lightbulb`）

所有 icon SHALL 使用 `js/icons.js` ICONS registry。

#### Scenario: 展開顯示 5 個子項目

- **WHEN** 使用者點擊 ▲ 按鈕
- **THEN** 5 個圓形子項目按鈕從觸發按鈕上方依序向上排列，每個帶有 icon 與文字標籤

#### Scenario: 子項目展開動畫

- **WHEN** Speed Dial 展開
- **THEN** 子項目 SHALL 以 stagger 動畫由下到上依序出現（每個延遲約 50ms）

### Requirement: Speed Dial backdrop

Speed Dial 展開時 SHALL 顯示半透明 backdrop 遮罩。點擊 backdrop SHALL 關閉 Speed Dial。

#### Scenario: 展開時顯示 backdrop

- **WHEN** Speed Dial 展開
- **THEN** 頁面顯示半透明 backdrop 遮罩

#### Scenario: 點擊 backdrop 關閉

- **WHEN** Speed Dial 展開狀態下使用者點擊 backdrop
- **THEN** Speed Dial 關閉，子項目消失，backdrop 消失，按鈕 icon 切回 ▲

### Requirement: Speed Dial 觸發 Bottom Sheet

點擊 Speed Dial 子項目 SHALL 關閉 Speed Dial 並開啟 Bottom Sheet，顯示對應內容。

#### Scenario: 點擊航班子項目

- **WHEN** 使用者點擊航班子項目
- **THEN** Speed Dial 關閉，Bottom Sheet 開啟並顯示航班資訊內容

#### Scenario: 點擊清單子項目

- **WHEN** 使用者點擊清單子項目
- **THEN** Speed Dial 關閉，Bottom Sheet 開啟並顯示出發前確認清單內容

### Requirement: 列印模式隱藏 Speed Dial

列印模式（`.print-mode`）和 `@media print` 下，Speed Dial 觸發按鈕與子項目 SHALL 隱藏。

#### Scenario: 列印模式下不顯示

- **WHEN** 使用者進入列印模式
- **THEN** Speed Dial 按鈕及子項目不顯示（`display: none !important`）

### Requirement: 桌機與手機版皆啟用

Speed Dial SHALL 在所有螢幕寬度下啟用，桌機版與手機版行為一致。

#### Scenario: 桌機版顯示 Speed Dial

- **WHEN** 使用者在 ≥768px 寬度裝置開啟行程頁
- **THEN** 右下角顯示 Speed Dial 觸發按鈕
