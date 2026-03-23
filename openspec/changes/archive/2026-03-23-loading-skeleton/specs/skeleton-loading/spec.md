## ADDED Requirements

### Requirement: 骨架屏載入動畫
系統 SHALL 在載入行程資料時顯示骨架屏（模擬真實佈局的灰色方塊 + shimmer 動畫），取代文字載入提示。

#### Scenario: 全頁載入
- **WHEN** 行程資料初始載入中
- **THEN** SHALL 顯示 2-3 個 DaySkeleton 元件
- **THEN** SHALL 不顯示文字「載入中...」

#### Scenario: 單日載入
- **WHEN** 切換到尚未載入的天
- **THEN** SHALL 顯示 1 個 DaySkeleton
- **THEN** 資料到達後 SHALL 以 fade-in 過渡到真實內容

#### Scenario: Shimmer 動畫
- **WHEN** 骨架屏顯示中
- **THEN** 骨架方塊 SHALL 有從左到右的光澤掃過動畫（1.5s 循環）

### Requirement: Dark mode 骨架適配
骨架屏 SHALL 在 dark mode 下自動適配色調。

#### Scenario: dark mode 骨架
- **WHEN** dark mode 下顯示骨架屏
- **THEN** 骨架色調 SHALL 使用 var(--color-tertiary) / var(--color-secondary)，融入暗色背景
