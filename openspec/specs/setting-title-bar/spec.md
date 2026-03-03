## ADDED Requirements

### Requirement: 設定頁面置頂標題列

setting.html SHALL 在 `.sticky-nav` 內顯示標題文字「設定」，標題列在所有裝置尺寸下皆可見且置頂。

#### Scenario: 手機版標題列完整顯示

- **WHEN** viewport width < 768px 且 setting 頁面載入完成
- **THEN** sticky-nav SHALL 顯示漢堡按鈕（左）與標題文字「設定」

#### Scenario: 桌機版標題列隱藏漢堡按鈕

- **WHEN** viewport width ≥ 768px 且 setting 頁面載入完成
- **THEN** sticky-nav SHALL 顯示標題文字「設定」，漢堡按鈕 SHALL 隱藏

#### Scenario: 標題列背景色

- **WHEN** 標題列渲染完成
- **THEN** 標題列背景色 SHALL 使用 `var(--card-bg)`
