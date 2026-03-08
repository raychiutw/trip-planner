## MODIFIED Requirements

### Requirement: Speed Dial 按鈕組成與排序
Speed Dial SHALL 包含 6 個按鈕，展開後由上到下（離 trigger 最遠到最近）排列為：suggestions、flights、driving、checklist、backup、emergency。HTML 中按鈕順序 SHALL 為 emergency（第一個，最靠近 trigger）到 suggestions（最後一個，最遠離 trigger）。

#### Scenario: Speed Dial 展開顯示 6 個按鈕
- **WHEN** 使用者點擊 Speed Dial trigger
- **THEN** 展開顯示 6 個按鈕：suggestions（最上方）、flights、driving、checklist、backup、emergency（最下方）

#### Scenario: driving 按鈕使用交通 icon
- **WHEN** Speed Dial 展開
- **THEN** driving 按鈕 SHALL 顯示交通工具相關 inline SVG icon
- **AND** aria-label 為「交通統計」

#### Scenario: suggestions 按鈕位於最上方
- **WHEN** Speed Dial 展開
- **THEN** suggestions 按鈕 SHALL 位於離 trigger 最遠的位置（展開後視覺最上方）

### Requirement: Speed Dial 桌機手機一致
Speed Dial 及其按鈕 SHALL 在所有裝置尺寸上顯示且行為一致。

#### Scenario: 桌機版 Speed Dial 可用
- **WHEN** 使用者在 >=768px 寬度裝置操作
- **THEN** Speed Dial trigger 可見且可點擊展開

#### Scenario: 手機版 Speed Dial 可用
- **WHEN** 使用者在 <768px 寬度裝置操作
- **THEN** Speed Dial trigger 可見且可點擊展開
