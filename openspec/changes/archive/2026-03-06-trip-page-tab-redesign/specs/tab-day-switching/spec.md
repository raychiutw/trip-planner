## ADDED Requirements

### Requirement: 一次顯示一天

行程頁 SHALL 以 tab 模式呈現天數內容，同一時間只顯示一天的 section。所有天數 section SHALL 同時渲染於 DOM，以 CSS `display` 切換可見性。

#### Scenario: 頁面載入後顯示第一天

- **WHEN** 行程頁載入完成
- **THEN** 僅第一天的 `.day-section` 為 `display: block`，其餘天數為 `display: none`

#### Scenario: 點擊 pill 切換天數

- **WHEN** 使用者點擊 nav pill 數字 "3"
- **THEN** 第 3 天的 `.day-section` 變為 `display: block`，其餘天數 `.day-section` 變為 `display: none`
- **AND** pill "3" 獲得 `.active` class，其餘 pill 移除 `.active`

#### Scenario: 切換天數保留 DOM 狀態

- **WHEN** 使用者在第 1 天展開某個時間軸項目，切換至第 2 天再切回第 1 天
- **THEN** 先前展開的時間軸項目仍為展開狀態

### Requirement: 列印模式顯示所有天數

列印模式（`.print-mode`）SHALL 將所有天數 `.day-section` 設為 `display: block`，覆蓋 tab 模式的隱藏邏輯。

#### Scenario: 進入列印模式

- **WHEN** 使用者觸發列印模式
- **THEN** 所有天數 section 同時顯示，頁面可完整列印

#### Scenario: 離開列印模式

- **WHEN** 使用者離開列印模式
- **THEN** 恢復為僅顯示當前 active tab 對應的天數 section

### Requirement: 非天數 section 隱藏

行程頁底部原本渲染的非天數 section（航班/清單/備案/緊急/建議）SHALL 不再直接顯示於主內容區。這些內容改由 Speed Dial + Bottom Sheet 觸發顯示。

#### Scenario: 頁面載入後無非天數 section

- **WHEN** 行程頁載入完成
- **THEN** 主內容區（`.container`）內不顯示航班、清單、備案、緊急、建議等 section
