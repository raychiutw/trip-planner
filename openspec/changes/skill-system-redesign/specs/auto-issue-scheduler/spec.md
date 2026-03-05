## ADDED Requirements

### Requirement: tp-issue 自動排程腳本

`scripts/` 目錄 SHALL 包含 Windows Task Scheduler 所需的 PowerShell 腳本，每 15 分鐘自動執行 `/tp-issue`。

#### Scenario: 排程執行腳本

- **WHEN** Windows Task Scheduler 觸發排程
- **THEN** SHALL 執行 `scripts/tp-issue-scheduler.ps1`
- **AND** 腳本 SHALL 切換到專案目錄並執行 `claude --dangerously-skip-permissions -p "/tp-issue"`
- **AND** 執行結果 SHALL 追加到 `scripts/tp-issue.log`（含時間戳）

#### Scenario: 排程註冊

- **WHEN** 使用者執行 `scripts/register-scheduler.ps1`
- **THEN** SHALL 在 Windows Task Scheduler 註冊任務 `TripPlanner-AutoIssue`
- **AND** 觸發間隔 SHALL 為每 15 分鐘
- **AND** 設定 SHALL 允許電池模式執行、多重實例忽略新的

#### Scenario: 排程移除

- **WHEN** 使用者執行 `scripts/unregister-scheduler.ps1`
- **THEN** SHALL 移除 Windows Task Scheduler 中的 `TripPlanner-AutoIssue` 任務

#### Scenario: log 格式

- **WHEN** tp-issue-scheduler.ps1 執行
- **THEN** log SHALL 包含開始時間戳、Claude CLI 輸出、結束時間戳，每次執行以 `---` 分隔

### Requirement: 排程前提條件

排程正常運作 SHALL 要求以下環境已就緒。

#### Scenario: 環境檢查

- **WHEN** tp-issue-scheduler.ps1 執行
- **THEN** SHALL 要求 Git credentials 已設定、GitHub CLI（gh）已登入、Node.js 在 PATH、Claude CLI 在 PATH
