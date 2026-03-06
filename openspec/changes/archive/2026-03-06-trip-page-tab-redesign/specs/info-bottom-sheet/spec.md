## MODIFIED Requirements

### Requirement: Bottom Sheet 內容

**變更**：Bottom Sheet 不再固定顯示 info-panel 三張卡片，改為依 Speed Dial 子項目選擇動態顯示對應內容。

Bottom Sheet 的 `#bottomSheetBody` SHALL 依據觸發來源動態渲染對應內容：

| 觸發子項目 | 渲染內容 |
|-----------|---------|
| 航班 | 航班資訊 section HTML |
| 清單 | 出發前確認清單 section HTML |
| 備案 | 颱風備案 section HTML |
| 緊急 | 緊急聯絡 section HTML |
| 建議 | AI 行程建議 section HTML |

#### Scenario: 點擊航班後 Bottom Sheet 顯示航班內容

- **WHEN** 使用者透過 Speed Dial 點擊航班子項目
- **THEN** Bottom Sheet 開啟，`#bottomSheetBody` 顯示航班資訊 HTML

#### Scenario: 點擊清單後 Bottom Sheet 顯示清單內容

- **WHEN** 使用者透過 Speed Dial 點擊清單子項目
- **THEN** Bottom Sheet 開啟，`#bottomSheetBody` 顯示出發前確認清單 HTML

#### Scenario: 切換不同子項目

- **WHEN** 使用者關閉 Bottom Sheet 後，透過 Speed Dial 點擊不同子項目
- **THEN** Bottom Sheet 開啟並顯示新選擇的對應內容

### Requirement: Bottom Sheet 僅手機版啟用

**變更**：Bottom Sheet 在所有螢幕寬度下皆可啟用（因 Speed Dial 在桌機/手機版皆啟用）。

Bottom Sheet 及 Speed Dial 的開關行為 SHALL 在所有螢幕寬度下生效。

#### Scenario: 桌機版可觸發 Bottom Sheet

- **WHEN** 使用者在 ≥768px 寬度裝置透過 Speed Dial 點擊子項目
- **THEN** Bottom Sheet 從畫面底部滑入，顯示對應內容

### Requirement: renderInfoPanel 同時渲染兩個目標

**變更**：`renderInfoPanel` 不再渲染至 `#bottomSheetBody`。Bottom Sheet 內容改由 Speed Dial 子項目動態觸發渲染。

`renderInfoPanel(data)` SHALL 僅渲染至 `#infoPanel`（桌機版右側欄）。

#### Scenario: 行程載入後僅渲染 info-panel

- **WHEN** index.html 行程資料載入完成
- **THEN** `#infoPanel` 填入 info-panel 三張卡片 HTML
- **AND** `#bottomSheetBody` 保持空白，等待 Speed Dial 觸發
