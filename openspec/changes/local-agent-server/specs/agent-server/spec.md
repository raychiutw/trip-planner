## ADDED Requirements

### Requirement: Express server 監聽 :3001
系統 SHALL 在 `server/index.js` 啟動 Express server，監聽 port 3001。

#### Scenario: 正常啟動
- **WHEN** 執行 `node server/index.js`
- **THEN** server 在 :3001 啟動並輸出 log

### Requirement: GET /health 健康檢查
系統 SHALL 提供 GET /health endpoint，回傳 `{ ok: true }`。

#### Scenario: 健康檢查
- **WHEN** GET /health
- **THEN** 回傳 200 `{ ok: true, uptime: N }`

### Requirement: POST /process 觸發 Claude 處理
系統 SHALL 提供 POST /process endpoint，接受 `{ requestId }` body，呼叫 Claude Agent SDK 處理該請求。

#### Scenario: 成功處理
- **WHEN** POST /process { requestId: 42 } 帶有效的 X-Webhook-Secret
- **THEN** Agent SDK 讀取請求 → 處理 → 回覆關閉 → 回傳 200 `{ ok: true }`

#### Scenario: 處理失敗
- **WHEN** Agent SDK 執行失敗
- **THEN** 回傳 500 `{ error: "..." }`，server 不 crash

#### Scenario: 並發請求
- **WHEN** 同時收到多個 POST /process
- **THEN** 序列處理（queue），不同時跑多個 Agent SDK query

### Requirement: Webhook Secret 認證
POST /process SHALL 驗證 `X-Webhook-Secret` header 與環境變數 `WEBHOOK_SECRET` 相符。

#### Scenario: 有效 secret
- **WHEN** header 帶正確 secret
- **THEN** 正常處理

#### Scenario: 無效 secret
- **WHEN** header 缺失或不符
- **THEN** 回傳 403

### Requirement: Agent SDK 使用 OAuth
Agent SDK query() SHALL 使用 Claude Code 的 OAuth token 認證，不使用 Anthropic API key。

#### Scenario: OAuth 有效
- **WHEN** claude login 的 token 有效
- **THEN** Agent SDK 正常呼叫 Claude

### Requirement: Graceful shutdown
server 收到 SIGINT/SIGTERM SHALL 優雅關閉（等待進行中的 query 完成，最多 30 秒）。

#### Scenario: 關閉中有進行中的請求
- **WHEN** SIGINT 且正在處理請求
- **THEN** 等請求完成後再關閉，最多 30 秒
