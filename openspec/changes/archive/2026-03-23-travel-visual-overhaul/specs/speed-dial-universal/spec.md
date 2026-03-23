## ADDED Requirements

### Requirement: Speed Dial 新增 printer 項目
Speed Dial MUST 包含 `printer` 項目（icon: `printer`，label: `列印模式`）。點擊後 SHALL 呼叫 TripPage 傳入的 `onPrint` callback（即 `togglePrint`），切換列印模式狀態；同時 SHALL 關閉 Speed Dial 展開狀態。

`SpeedDial` 元件 SHALL 透過 props 接收 `onPrint: () => void`，不直接操作 DOM 或 window。

#### Scenario: 點擊 printer 項目切換列印模式
- **WHEN** 使用者展開 Speed Dial 並點擊 `printer` 項目
- **THEN** 系統 SHALL 呼叫 `onPrint` callback，`body` 的 `.print-mode` class SHALL 切換，Speed Dial SHALL 關閉

#### Scenario: printer 項目出現在 Speed Dial 項目列表中
- **WHEN** 行程載入完成後 Speed Dial 渲染
- **THEN** Speed Dial 項目列表 SHALL 包含 `data-content="printer"` 的按鈕，icon 為 `printer`，aria-label 為「列印模式」

### Requirement: Speed Dial 新增 settings 項目
Speed Dial MUST 包含 `settings` 項目（icon: `gear`，label: `設定`）。點擊後 SHALL 導航至 `setting.html`；同時 SHALL 關閉 Speed Dial 展開狀態。

`SpeedDial` 元件 SHALL 透過 props 接收 `settingsHref: string`（預設值 `'setting.html'`），以 `window.location.href` 導航或以 `<a>` 標籤實作，不使用 React Router。

#### Scenario: 點擊 settings 項目導航至設定頁
- **WHEN** 使用者展開 Speed Dial 並點擊 `settings` 項目
- **THEN** 瀏覽器 SHALL 導航至 `setting.html`，Speed Dial SHALL 關閉

#### Scenario: settings 項目出現在 Speed Dial 項目列表中
- **WHEN** 行程載入完成後 Speed Dial 渲染
- **THEN** Speed Dial 項目列表 SHALL 包含 `data-content="settings"` 的按鈕或連結，icon 為 `gear`，aria-label 為「設定」

## MODIFIED Requirements

### Requirement: Speed Dial 全平台顯示
Speed Dial 元件（`.speed-dial`）SHALL 在所有螢幕寬度下顯示，包含桌面版（≥768px）。CSS 中 SHALL NOT 存在任何以媒體查詢隱藏 Speed Dial 的規則（如 `@media (min-width: 768px) { .speed-dial { display: none } }`）。

Speed Dial 在桌面版的定位 SHALL 維持右下角（`position: fixed; bottom: ...; right: 20px`），不與右側 InfoPanel 重疊（InfoPanel 固定於右側欄，Speed Dial 位於右下角懸浮層）。

#### Scenario: 桌面版 Speed Dial 可見
- **WHEN** 使用者以桌面版瀏覽器（viewport ≥768px）開啟行程頁
- **THEN** `.speed-dial` 元素 SHALL 可見（`display` 非 `none`、`visibility` 非 `hidden`），可正常點擊展開

#### Scenario: 手機版 Speed Dial 維持可見
- **WHEN** 使用者以手機版瀏覽器（viewport <768px）開啟行程頁
- **THEN** `.speed-dial` 元素 SHALL 維持可見，行為與修改前一致

#### Scenario: Speed Dial 與 InfoPanel 不重疊
- **WHEN** 桌面版（≥768px）且 InfoPanel 展開顯示於右側欄
- **THEN** Speed Dial trigger 按鈕 SHALL 位於右下角，不與 InfoPanel 內容區域重疊遮蔽
