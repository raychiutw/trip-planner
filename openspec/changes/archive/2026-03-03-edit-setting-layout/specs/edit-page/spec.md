## MODIFIED Requirements

### Requirement: Edit 頁面桌機版訊息區頂部留白

桌機版（viewport width ≥ 768px）的 `.chat-messages-inner` SHALL 具備頂部留白（`padding-top: 48px`），使訊息內容不緊貼 viewport 頂端，視覺感受接近 Claude Chats 頁的佈局。行動版不加頂部留白。

#### Scenario: 桌機版訊息區頂部留白

- **WHEN** viewport width ≥ 768px 且開啟 edit.html
- **THEN** `.chat-messages-inner` 頂部 padding SHALL 為 `48px`，問候語卡片不緊貼頂端

#### Scenario: 行動版不受影響

- **WHEN** viewport width < 768px 且開啟 edit.html
- **THEN** `.chat-messages-inner` 的頂部 padding SHALL 維持原有行動版預設，不加額外留白

### Requirement: Edit 頁面輸入卡片亮色背景

亮色模式下 `.edit-input-card` 的背景 SHALL 為純白（`#FFFFFF`），與 Claude 輸入框視覺一致。深色模式維持既有樣式不變。

#### Scenario: 亮色模式輸入卡片白底

- **WHEN** 亮色模式（非 `body.dark`）下開啟 edit.html
- **THEN** `.edit-input-card` 背景 SHALL 為 `#FFFFFF`

#### Scenario: 深色模式輸入卡片不受影響

- **WHEN** 深色模式（`body.dark`）下開啟 edit.html
- **THEN** `.edit-input-card` 背景 SHALL 維持既有深色模式規則（`box-shadow: 0 2px 12px rgba(0,0,0,0.25)`），背景色不變

### Requirement: Issue 歷史紀錄（per_page 更新）

Issue 歷史 SHALL 透過 GitHub API（`--label trip-edit --state all --per_page 20`）拉取，每次最多顯示 20 筆 issue。

#### Scenario: 每頁顯示最多 20 筆 Issues

- **WHEN** GitHub API 成功回傳 issue 列表
- **THEN** 請求參數 SHALL 包含 `per_page=20`，最多渲染 20 筆 issue 氣泡
