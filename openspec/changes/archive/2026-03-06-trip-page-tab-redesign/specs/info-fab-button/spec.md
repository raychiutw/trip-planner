## MODIFIED Requirements

### Requirement: 手機版 ℹ FAB 按鈕顯示

**變更**：ℹ FAB 改為 Speed Dial 觸發按鈕。不再僅在手機版顯示，桌機與手機版皆顯示。icon 從 info 改為三角形（▲/▼）。

Speed Dial 觸發按鈕 SHALL 在所有螢幕寬度下顯示於畫面右下角，固定位於 ＋ FAB 正上方，兩者間距 12px。

#### Scenario: 手機版顯示 Speed Dial 按鈕

- **WHEN** 使用者在 <768px 寬度裝置上開啟 index.html
- **THEN** 畫面右下角顯示 Speed Dial 觸發按鈕（圓形，位於 ＋ FAB 正上方）

#### Scenario: 桌機版顯示 Speed Dial 按鈕

- **WHEN** 使用者在 ≥768px 寬度裝置上開啟 index.html
- **THEN** 畫面右下角顯示 Speed Dial 觸發按鈕

### Requirement: ℹ FAB 按鈕使用 info icon

**變更**：icon 從 info 改為三角形。

Speed Dial 觸發按鈕 SHALL 使用 inline SVG 三角形 icon。收合時顯示向上三角形（▲），展開時顯示向下三角形（▼）。

#### Scenario: 收合時顯示 ▲

- **WHEN** Speed Dial 處於收合狀態
- **THEN** 按鈕內顯示向上三角形 inline SVG

#### Scenario: 展開時顯示 ▼

- **WHEN** Speed Dial 處於展開狀態
- **THEN** 按鈕內顯示向下三角形 inline SVG

### Requirement: ℹ FAB 點擊開啟 Bottom Sheet

**變更**：點擊行為改為展開/收合 Speed Dial，不再直接開啟 Bottom Sheet。Bottom Sheet 改由 Speed Dial 子項目觸發。

使用者點擊 Speed Dial 按鈕後，系統 SHALL 展開或收合 Speed Dial 子項目列表。

#### Scenario: 點擊 ▲ 展開 Speed Dial

- **WHEN** 使用者點擊 Speed Dial 觸發按鈕（收合狀態）
- **THEN** Speed Dial 子項目從按鈕上方展開，backdrop 顯示

#### Scenario: 點擊 ▼ 收合 Speed Dial

- **WHEN** 使用者點擊 Speed Dial 觸發按鈕（展開狀態）
- **THEN** Speed Dial 子項目收合，backdrop 消失
