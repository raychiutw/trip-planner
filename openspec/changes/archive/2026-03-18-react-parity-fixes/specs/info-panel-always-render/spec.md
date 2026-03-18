## MODIFIED Requirements

### Requirement: info panel 無條件渲染

`InfoPanel` 元件 SHALL 無條件渲染於 `<aside className="info-panel">`，不受 panel 的當前可見性影響。

- SHALL NOT 以 `offsetParent`、`offsetWidth`、`offsetHeight` 或任何可見性屬性作為渲染的前置條件
- panel 在 768–1199px 視口下為 `display: none` 屬於 CSS 控制的顯示狀態，React 元件 SHALL 仍然掛載
- InfoPanel SHALL 只渲染 **Countdown** 和 **TripStatsCard** 兩張卡片
- InfoPanel SHALL NOT 渲染 Flights、Checklist、Backup、Emergency、Suggestions、DrivingStats 等 doc 內容（這些只在 SpeedDial bottom sheet 中顯示）

#### Scenario: panel display:none 時仍渲染 React 元件

- **WHEN** InfoPanel 元件掛載且 CSS computed display 為 `none`
- **THEN** InfoPanel 的 DOM 子樹 SHALL 包含 Countdown 和 TripStatsCard 內容

#### Scenario: panel 轉為可見後內容正確

- **WHEN** CSS media query 使 `#infoPanel` 的 display 從 `none` 變為 `block`（視口 ≥1200px）
- **THEN** panel 內容 SHALL 顯示 Countdown 倒數天數和 TripStatsCard 行程摘要

#### Scenario: 桌面 sidebar 不顯示 doc 內容

- **WHEN** InfoPanel 元件渲染於桌面視口（≥1200px）
- **THEN** sidebar SHALL NOT 包含航班、確認清單、備案、緊急聯絡、行程建議、交通統計等卡片
