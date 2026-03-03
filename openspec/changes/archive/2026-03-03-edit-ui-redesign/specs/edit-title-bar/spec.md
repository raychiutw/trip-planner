## ADDED Requirements

### Requirement: 編輯頁面置頂標題列

edit.html SHALL 在 `.sticky-nav` 內顯示標題文字「編輯行程 · {行程名稱}」，標題列在所有裝置尺寸下皆可見且置頂。

#### Scenario: 手機版標題列完整顯示

- **WHEN** viewport width < 768px 且 edit 頁面載入完成
- **THEN** sticky-nav SHALL 顯示漢堡按鈕（左）與標題文字「編輯行程 · {行程名稱}」，標題文字溢位時以 `text-overflow: ellipsis` 截斷

#### Scenario: 桌機版標題列隱藏漢堡按鈕

- **WHEN** viewport width ≥ 768px 且 edit 頁面載入完成
- **THEN** sticky-nav SHALL 顯示標題文字「編輯行程 · {行程名稱}」，漢堡按鈕（`.dh-menu`）SHALL 隱藏（因 sidebar 已提供相同功能）

#### Scenario: 標題列行程名稱動態取自行程資料

- **WHEN** edit 頁面成功載入行程設定
- **THEN** 標題列 SHALL 顯示對應行程的 `tripName`，格式為「編輯行程 · {tripName}」

#### Scenario: 標題列背景色與頁面一致

- **WHEN** 標題列渲染完成
- **THEN** 標題列背景色 SHALL 使用 `var(--card-bg)`，與頁面設計風格一致
