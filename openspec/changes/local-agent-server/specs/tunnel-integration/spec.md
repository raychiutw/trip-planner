## ADDED Requirements

### Requirement: Named Tunnel 固定 URL
系統 SHALL 使用 Cloudflare Named Tunnel 提供固定的公開 URL（UUID.cfargotunnel.com），指向 localhost:3001。

#### Scenario: Tunnel 連線
- **WHEN** cloudflared tunnel run 啟動
- **THEN** 外部可透過固定 URL 存取 localhost:3001

### Requirement: Pages Function webhook 觸發
`functions/api/requests.ts` 的 POST handler SHALL 在 D1 寫入成功後，fire-and-forget 呼叫 `TUNNEL_URL/process`。

#### Scenario: 正常觸發
- **WHEN** 旅伴 POST /api/requests 成功
- **THEN** Pages Function 非同步呼叫 Tunnel URL 帶 requestId
- **AND** 不等待回應，立刻回傳 201 給旅伴

#### Scenario: Tunnel 不通
- **WHEN** 本機 server 未啟動（Tunnel 不通）
- **THEN** fetch catch 靜默失敗，請求留在 DB，旅伴正常收到 201

#### Scenario: TUNNEL_URL 未設定
- **WHEN** 環境變數 TUNNEL_URL 為空
- **THEN** 跳過 webhook 呼叫，只寫入 D1

### Requirement: tunnel.yml 設定檔
`server/tunnel.yml` SHALL 包含 tunnel UUID 和 credentials-file 路徑，ingress 指向 localhost:3001。

#### Scenario: 啟動 tunnel
- **WHEN** `cloudflared tunnel --config server/tunnel.yml run`
- **THEN** tunnel 正常建立連線
