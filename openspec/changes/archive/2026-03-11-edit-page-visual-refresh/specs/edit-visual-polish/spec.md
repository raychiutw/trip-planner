## ADDED Requirements

### Requirement: Issue 項目卡片化

Issue 列表中每個 `.issue-item` SHALL 具備卡片外觀：`background: var(--bg-secondary)`、`border-radius: var(--radius-md)`、`padding: 12px 16px`。項目之間 SHALL 以 `gap: 8px` 分隔，不使用虛線或 border。Hover 時背景 SHALL 變為 `var(--hover-bg)`，transition 使用 `var(--duration-fast)`。

#### Scenario: Issue 項目顯示為獨立卡片

- **WHEN** edit.html 載入並有 issue 資料
- **THEN** 每個 `.issue-item` SHALL 有 `var(--bg-secondary)` 背景和 `var(--radius-md)` 圓角

#### Scenario: Issue 卡片 hover 效果

- **WHEN** 使用者將游標移到 issue 項目上
- **THEN** 背景 SHALL 平滑過渡為 `var(--hover-bg)`

#### Scenario: 卡片間距

- **WHEN** issue 列表有多筆資料
- **THEN** `.issue-list` SHALL 以 `gap: 8px` 分隔各卡片，不使用 border 分隔線

### Requirement: Issue Header 防溢

`.issue-item-header` SHALL 具備 `flex-wrap: wrap`，確保窄螢幕下 badge 可換行顯示，避免擠壓標題。

#### Scenario: 窄螢幕 badge 換行

- **WHEN** 螢幕寬度不足以容納標題與所有 badge
- **THEN** badge SHALL 換行至下一列，標題保持完整顯示

### Requirement: Badge 精緻化

`.issue-badge` 字級 SHALL 為 `var(--fs-caption)`。Open badge 背景 SHALL 為 `#1A7F37`（dark: `#2EA043`），closed badge 背景 SHALL 為 `#6E40C9`（dark: `#8B5CF6`）。

#### Scenario: Badge 字級

- **WHEN** 渲染 issue badge
- **THEN** font-size SHALL 為 `var(--fs-caption)`

#### Scenario: Badge dark mode 色值

- **WHEN** 頁面為 dark mode
- **THEN** open badge 背景 SHALL 為 `#2EA043`，closed badge 背景 SHALL 為 `#8B5CF6`

### Requirement: Body 與 Meta 間距

`.issue-item-body` 的 `margin-top` SHALL 為 `8px`。`.issue-item-meta` 的 `margin-top` SHALL 為 `8px`，font-size SHALL 為 `var(--fs-caption)`。

#### Scenario: Body 與 header 間距

- **WHEN** issue 項目有 body preview
- **THEN** `.issue-item-body` 與 header 之間 SHALL 有 `8px` 間距

#### Scenario: Meta 字級

- **WHEN** 渲染 issue 項目的 meta 資訊
- **THEN** font-size SHALL 為 `var(--fs-caption)`

### Requirement: Reply 分隔線

`.issue-reply` SHALL 以 `border-top: 1px solid var(--border)` 與問題體視覺分隔。`margin-top` SHALL 為 `12px`，`padding-top` SHALL 為 `12px`。

#### Scenario: Reply 與問題體之間有分隔線

- **WHEN** issue 有回覆內容
- **THEN** 回覆區域上方 SHALL 有 `1px solid var(--border)` 分隔線和 `12px` 上方留白

### Requirement: 空白狀態卡片化

`.edit-issues-loading` 和 `.edit-issues-empty` SHALL 具備 `background: var(--bg-secondary)`、`border-radius: var(--radius-md)`、`font-size: var(--fs-callout)`、`padding: 32px 16px`。

#### Scenario: 空白狀態顯示為卡片

- **WHEN** issue 列表為空
- **THEN** 「尚無修改紀錄」SHALL 以卡片形式顯示，具備背景色和圓角

### Requirement: Mode Pill 高亮

`.edit-mode-pill.selected` 的背景 SHALL 為 `var(--accent-bg)`，文字色 SHALL 為 `var(--accent)`。

#### Scenario: Selected pill 與 hover 可區分

- **WHEN** 使用者選擇一個 mode pill
- **THEN** selected pill 背景 SHALL 為 `var(--accent-bg)`（非 `var(--hover-bg)`），文字色 SHALL 為 `var(--accent)`

### Requirement: Send Button 微動畫

`.edit-send-btn` 在 disabled 狀態 SHALL 有 `transform: scale(0.92)`，enabled 狀態 SHALL 有 `transform: scale(1)`。Transition SHALL 包含 `transform var(--duration-fast)`。

#### Scenario: 按鈕狀態切換動畫

- **WHEN** 使用者開始輸入文字，send button 從 disabled 變為 enabled
- **THEN** 按鈕 SHALL 從 0.92 倍放大到 1.0 倍，配合背景色 transition

### Requirement: Nav 標題精確置中

`.chat-container .sticky-nav::before` 的寬度 SHALL 為 `var(--tap-min)`，與 `.nav-close-btn` 等寬，使標題精確置中。

#### Scenario: 標題水平置中

- **WHEN** edit.html 載入
- **THEN** nav 標題 SHALL 在 sticky-nav 中精確水平置中，左側 spacer 寬度等於右側 close button 寬度

### Requirement: Input Bar safe-area

`.edit-input-bar` 的 bottom padding SHALL 使用 `max(16px, env(safe-area-inset-bottom, 16px))`，適配 iOS 裝置。

#### Scenario: iOS safe-area 適配

- **WHEN** 在有 safe area 的裝置上開啟 edit.html
- **THEN** input bar 底部 SHALL 有足夠的 padding 避免被 home indicator 遮擋
