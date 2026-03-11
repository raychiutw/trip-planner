## MODIFIED Requirements

### Requirement: Issue 歷史紀錄

Issue 歷史 SHALL 透過 GitHub API（`--label trip-edit --state all --per_page 20`）拉取，每筆 issue 以卡片化列表項目渲染（`background: var(--bg-secondary)`、`border-radius: var(--radius-md)`），項目之間以 `gap: 8px` 分隔。每項 SHALL 包含 status badge（pill 形式，open 綠底 / closed 紫底）、mode badge、標題連結、issue body 預覽（2 行截斷）、issue 編號與建立時間。載入中顯示「載入中…」卡片，失敗顯示「無法載入紀錄」。

#### Scenario: Issues 以卡片化列表項目顯示

- **WHEN** GitHub API 成功回傳 issue 列表
- **THEN** 每筆 issue SHALL 渲染為獨立卡片（`var(--bg-secondary)` 背景、`var(--radius-md)` 圓角），包含 status badge、標題（可點擊跳轉 GitHub）、body 預覽、meta 行顯示 `#N · 時間`

#### Scenario: Issue 項目之間以 gap 分隔

- **WHEN** issue 列表有多筆資料
- **THEN** 每筆 issue 項目之間 SHALL 以 `gap: 8px` 分隔，不使用虛線或 border

#### Scenario: Open issue 顯示綠色 badge

- **WHEN** 渲染一筆 state 為 open 的 issue
- **THEN** 顯示綠色 pill badge（`#1A7F37`，dark: `#2EA043`），含 `circle-dot` icon

#### Scenario: Closed issue 顯示紫色 badge

- **WHEN** 渲染一筆 state 為 closed 的 issue
- **THEN** 顯示紫色 pill badge（`#6E40C9`，dark: `#8B5CF6`），含 `check-circle` icon

#### Scenario: 載入中狀態

- **WHEN** GitHub API 請求進行中
- **THEN** 訊息區域顯示「載入中…」卡片（`var(--bg-secondary)` 背景）

#### Scenario: 載入失敗狀態

- **WHEN** GitHub API 請求失敗
- **THEN** 訊息區域顯示「無法載入紀錄」文字

#### Scenario: 無紀錄狀態

- **WHEN** GitHub API 回傳空列表
- **THEN** 訊息區域顯示「尚無修改紀錄」卡片（`var(--bg-secondary)` 背景）

#### Scenario: 每頁顯示最多 20 筆 Issues

- **WHEN** GitHub API 成功回傳 issue 列表
- **THEN** 請求參數 SHALL 包含 `per_page=20`，最多渲染 20 筆 issue

### Requirement: Edit 頁面桌機版訊息區頂部留白

桌機版（viewport width ≥ 768px）的 `.chat-messages-inner` SHALL 具備頂部留白（`padding-top: 24px`），使訊息內容不緊貼 viewport 頂端。行動版不加頂部留白。

#### Scenario: 桌機版訊息區頂部留白

- **WHEN** viewport width ≥ 768px 且開啟 edit.html
- **THEN** `.chat-messages-inner` 頂部 padding SHALL 為 `24px`

#### Scenario: 行動版不受影響

- **WHEN** viewport width < 768px 且開啟 edit.html
- **THEN** `.chat-messages-inner` 的頂部 padding SHALL 維持原有行動版預設，不加額外留白

### Requirement: Edit 頁面輸入卡片背景

`.edit-input-card` 的背景 SHALL 為 `var(--bg-secondary)`，light 與 dark mode 統一，不需額外的 `body.dark` 覆寫規則。

#### Scenario: 亮色模式輸入卡片背景

- **WHEN** 亮色模式（非 `body.dark`）下開啟 edit.html
- **THEN** `.edit-input-card` 背景 SHALL 為 `var(--bg-secondary)`

#### Scenario: 深色模式輸入卡片背景

- **WHEN** 深色模式（`body.dark`）下開啟 edit.html
- **THEN** `.edit-input-card` 背景 SHALL 為 `var(--bg-secondary)`（token 自動覆寫），不需獨立的 `body.dark` 規則
