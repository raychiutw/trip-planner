## ADDED Requirements

### Requirement: API 錯誤持久化
_middleware.ts SHALL 將 4xx/5xx 回應記錄到 D1 api_logs 表，包含 method、path、status、error message、duration。

#### Scenario: 4xx 回應記錄
- **WHEN** API 回傳 400/401/403/404/409
- **THEN** 寫入 api_logs 一筆記錄

#### Scenario: 5xx 回應記錄
- **WHEN** API 拋出未捕捉錯誤或回傳 500
- **THEN** 寫入 api_logs 一筆記錄，包含 error.message 和 error.stack

#### Scenario: 2xx 不記錄
- **WHEN** API 正常回傳 200/201
- **THEN** 不寫入 api_logs（減少 D1 寫入量）

### Requirement: api_logs 自動清理
系統 SHALL 保留最近 30 天的 api_logs，超過的自動刪除。

#### Scenario: 清理時機
- **WHEN** GitHub Actions 日報跑完
- **THEN** 執行 `DELETE FROM api_logs WHERE created_at < datetime('now', '-30 days')`
