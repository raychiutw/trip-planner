## ADDED Requirements

### Requirement: sticky-nav 右側動作按鈕

sticky-nav SHALL 在 pills 右側顯示設定與列印模式的動作按鈕。按鈕容器 `.nav-actions` 為 `flex-shrink: 0`，不隨 pill 捲動。

#### Scenario: 按鈕容器位置

- **WHEN** 行程頁載入完成
- **THEN** `.nav-actions` 位於 sticky-nav 最右側，與 pill 捲動區域分離

### Requirement: 桌機版 icon + 文字

桌機版（≥768px）設定與列印按鈕 SHALL 顯示 icon + 文字。

- 列印模式：🖨 icon + "列印模式" 文字，`data-action="toggle-print"`
- 設定：⚙ icon + "設定" 文字，`<a href="setting.html">`

icon SHALL 使用 `js/icons.js` ICONS registry（`print` 與 `gear`）。

#### Scenario: 桌機版顯示 icon + 文字

- **WHEN** 使用者在 ≥768px 寬度裝置開啟行程頁
- **THEN** sticky-nav 右側顯示「🖨 列印模式」和「⚙ 設定」按鈕（icon + 文字）

### Requirement: 手機版純 icon

手機版（<768px）設定與列印按鈕 SHALL 僅顯示 icon，不顯示文字。

#### Scenario: 手機版顯示純 icon

- **WHEN** 使用者在 <768px 寬度裝置開啟行程頁
- **THEN** sticky-nav 右側顯示 🖨 和 ⚙ icon，無伴隨文字

### Requirement: 列印模式按鈕功能

列印模式按鈕 SHALL 觸發 `data-action="toggle-print"` 事件，與現有列印模式行為一致。

#### Scenario: 點擊列印模式按鈕

- **WHEN** 使用者點擊列印模式按鈕
- **THEN** 頁面進入列印模式（所有天數展開、隱藏 FAB/nav）

### Requirement: 設定頁連結

設定按鈕 SHALL 為 `<a>` 連結，`href="setting.html"`，點擊後導航至設定頁。

#### Scenario: 點擊設定按鈕

- **WHEN** 使用者點擊設定按鈕
- **THEN** 頁面導航至 setting.html
