## MODIFIED Requirements

### Requirement: Bottom Sheet 僅手機版啟用
Bottom Sheet 及觸發按鈕的開關行為 SHALL 僅在手機版（<768px）生效；桌機版（≥768px）觸發按鈕隱藏，Bottom Sheet 不應可見。

注意：原本由 SpeedDial 的 ℹ FAB 觸發 InfoSheet，現改為由 QuickPanel 的 grid 項目觸發。QuickPanel 本身（FAB + Bottom Panel）在桌機版仍可使用，但 InfoSheet 的觸發入口改為 QuickPanel 內的項目按鈕。

#### Scenario: 桌機版 QuickPanel 可用但 InfoSheet 尺寸適配
- **WHEN** 使用者在 ≥768px 寬度裝置從 QuickPanel 點擊項目
- **THEN** InfoSheet SHALL 正常開啟，info-panel 照常顯示於右側欄
