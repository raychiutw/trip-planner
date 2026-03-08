## ADDED Requirements

### Requirement: Issue 列表顯示所有狀態
`loadIssues()` SHALL 查詢指定 tripSlug label 的最新 20 筆 Issue，不限 state（包含 open 與 closed）。

#### Scenario: 使用者送出 Issue 後可看到 open 狀態
- **WHEN** 使用者送出修改請求建立 Issue（state: open）
- **THEN** Issue 列表 SHALL 顯示該 open Issue，badge 為綠色 Open

#### Scenario: 已處理的 closed Issue 也顯示
- **WHEN** Issue 已被處理並關閉（state: closed）
- **THEN** Issue 列表 SHALL 顯示該 closed Issue，badge 為紫色 Closed

#### Scenario: 最多顯示 20 筆
- **WHEN** tripSlug 對應的 Issue 超過 20 筆
- **THEN** 只顯示最新的 20 筆（依建立時間倒序）

### Requirement: 有回覆的 Issue 載入 comment
`loadIssueReplies()` SHALL 對 `comments > 0` 的 Issue 非同步載入 comment。

#### Scenario: 有回覆的 Issue 顯示回覆內容
- **WHEN** Issue 的 `comments > 0`
- **THEN** SHALL 呼叫 GitHub API 載入該 Issue 的 comments

#### Scenario: 無回覆的 Issue 不載入
- **WHEN** Issue 的 `comments === 0`
- **THEN** SHALL 不呼叫 comments API，不顯示回覆區

### Requirement: 回覆以 GitHub 渲染 HTML 顯示
`loadIssueReplies()` SHALL 使用 GitHub API 的 `body_html` 欄位渲染回覆，取代純文字 `textContent`。

#### Scenario: markdown 表格正確渲染
- **WHEN** comment body 包含 markdown 表格語法
- **THEN** SHALL 以 HTML `<table>` 呈現，而非顯示 `|---|---|` 原始文字

#### Scenario: markdown 標題正確渲染
- **WHEN** comment body 包含 `## 標題`
- **THEN** SHALL 以 `<h2>` 呈現，而非顯示 `##` 文字

#### Scenario: 多個 comment 各自渲染
- **WHEN** Issue 有多個 comment
- **THEN** SHALL 各自渲染 `body_html`，以分隔線區隔

### Requirement: 回覆樣式支援深淺色模式
`.issue-reply` 下的 markdown HTML 標籤 SHALL 使用既有 CSS 變數，自動跟隨全站深淺色模式切換。

#### Scenario: 淺色模式顯示
- **WHEN** 頁面處於淺色模式
- **THEN** markdown HTML 的文字、表格框線、引用區塊 SHALL 使用淺色主題變數

#### Scenario: 深色模式顯示
- **WHEN** 頁面處於深色模式（body.dark）
- **THEN** markdown HTML SHALL 自動切換為深色主題變數，文字可讀、背景協調

### Requirement: font-size 遵循四級規範
`.issue-reply` 下的 markdown 標籤 SHALL 僅使用 `var(--fs-lg)`、`var(--fs-md)`、`var(--fs-sm)` 三級字型大小，禁止硬編碼 px/rem/em。

#### Scenario: 標題使用 --fs-lg
- **WHEN** 回覆包含 h2/h3 標題
- **THEN** SHALL 使用 `var(--fs-lg)` 或更小，不超過 --fs-lg

#### Scenario: 內文使用 --fs-sm
- **WHEN** 回覆包含段落、表格、列表等內文
- **THEN** SHALL 使用 `var(--fs-sm)`，與 `.issue-reply` 既有字型大小一致
