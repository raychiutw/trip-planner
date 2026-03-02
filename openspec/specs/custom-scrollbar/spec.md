## ADDED Requirements

### Requirement: 全站統一捲軸樣式

系統 SHALL 在 `shared.css` 定義全域捲軸樣式，適用所有可捲動元素。捲軸寬度 SHALL 為 6px，滑塊 SHALL 為圓角。亮色模式滑塊色 SHALL 為 `#C4C0BB`（hover `#9B9590`），深色模式 SHALL 為 `#5A5651`（hover `#7A7570`）。軌道背景 SHALL 為透明。

#### Scenario: 亮色模式捲軸

- **WHEN** 頁面在亮色模式下出現可捲動區域
- **THEN** 捲軸滑塊為 `#C4C0BB`、6px 寬、圓角，軌道透明

#### Scenario: 深色模式捲軸

- **WHEN** 頁面在深色模式下出現可捲動區域
- **THEN** 捲軸滑塊為 `#5A5651`、6px 寬、圓角，軌道透明

#### Scenario: hover 狀態

- **WHEN** 使用者將滑鼠移至捲軸滑塊上
- **THEN** 亮色模式滑塊變為 `#9B9590`，深色模式變為 `#7A7570`

### Requirement: 移除分散的 scrollbar 宣告

系統 SHALL 移除各 CSS 檔案中散落的 `scrollbar-width: thin` 宣告，改由全域樣式統一管理。

#### Scenario: 無重複 scrollbar 宣告

- **WHEN** 全域捲軸樣式生效後
- **THEN** 各頁面 CSS 中不再有獨立的 `scrollbar-width` 或 `scrollbar-color` 宣告
