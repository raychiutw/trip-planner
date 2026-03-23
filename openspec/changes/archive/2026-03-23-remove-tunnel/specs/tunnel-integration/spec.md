## REMOVED Requirements

### Requirement: Cloudflare Tunnel 即時 webhook
**Reason**: Tunnel 不穩定，維護成本高，排程機制已足夠
**Migration**: 所有請求改由 Windows Task Scheduler 每分鐘排程處理

### Requirement: Agent Server 本機常駐
**Reason**: 隨 Tunnel 一併移除，不再需要 localhost:3001 Express server
**Migration**: 刪除 server/ 目錄

### Requirement: TUNNEL_KV namespace
**Reason**: KV 只用於儲存 Quick Tunnel URL，Tunnel 移除後不再需要
**Migration**: 移除 wrangler.toml 的 kv_namespaces binding

### Requirement: webhook_failed 查詢參數
**Reason**: 不再區分 webhook 成功/失敗，所有 open 請求統一由排程處理
**Migration**: API 移除 webhook_failed 參數處理，排程改查 status=open

## MODIFIED Requirements

### Requirement: 排程處理旅伴請求
tp-request-scheduler SHALL 每分鐘查詢所有 `status=open` 的請求並處理，不再依賴 `webhook_failed` 條件。

#### Scenario: 有 open 請求時執行處理
- **WHEN** 排程執行且 API 回傳 open 請求數量 > 0
- **THEN** 執行 `claude /tp-request` 處理所有 open 請求

#### Scenario: 無 open 請求時跳過
- **WHEN** 排程執行且 API 回傳空陣列
- **THEN** 不執行任何動作，靜默結束
