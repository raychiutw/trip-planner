## ADDED Requirements

### Requirement: start-agent.ps1 一鍵啟動
`scripts/start-agent.ps1` SHALL 同時啟動 cloudflared tunnel 和 node server，一個腳本搞定。

#### Scenario: 正常啟動
- **WHEN** 執行 start-agent.ps1
- **THEN** cloudflared 在背景啟動，node server 在前景執行
- **AND** 兩者 log 都輸出到 console

### Requirement: Windows Task Scheduler 開機自啟
`scripts/register-agent.ps1` SHALL 註冊 Windows Task Scheduler 任務，在使用者登入時自動執行 start-agent.ps1。

#### Scenario: 登入後自動啟動
- **WHEN** 使用者登入 Windows
- **THEN** TripPlanner-AgentServer 排程任務自動觸發
- **AND** server + tunnel 啟動

### Requirement: unregister-agent.ps1 移除排程
`scripts/unregister-agent.ps1` SHALL 移除 TripPlanner-AgentServer 排程任務。

#### Scenario: 移除
- **WHEN** 執行 unregister-agent.ps1
- **THEN** 排程任務被移除

### Requirement: 取代輪詢排程
本變更完成後 SHALL 可移除 `TripPlanner-AutoRequest` 輪詢排程（每分鐘 tp-request），由推送模式取代。

#### Scenario: 移除舊排程
- **WHEN** agent server 穩定運作
- **THEN** 可安全移除 TripPlanner-AutoRequest 排程
