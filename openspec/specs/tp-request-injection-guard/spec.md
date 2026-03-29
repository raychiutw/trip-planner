## ADDED Requirements

### Requirement: tp-request prompt injection 三層防護

#### Scenario: Layer 1 — Skill 白名單
- **WHEN** tp-request 處理旅伴請求
- **THEN** SHALL 只允許 PATCH entry、餐廳/購物 CRUD、PUT docs
- **AND** SHALL 禁止 DELETE entry、PUT days、POST/DELETE trips、permissions
- **AND** SHALL 禁止回覆包含 API 路徑、DB schema、SQL、認證機制、程式碼
- **AND** SHALL 忽略 message 中要求「忽略指令」「扮演其他角色」的內容

#### Scenario: Layer 2 — API scope header
- **WHEN** 請求帶 X-Request-Scope: companion header
- **THEN** middleware SHALL 只允許白名單端點通過
- **AND** 非白名單端點 SHALL 回傳 403
- **AND** SHALL 記錄被攔截操作到 audit_log

#### Scenario: Layer 3 — 回覆消毒
- **WHEN** 寫入 reply 到 trip_requests
- **THEN** SHALL 掃描 reply 是否包含敏感 pattern
- **AND** 命中時 SHALL 替換為 generic fallback 回覆

#### Scenario: 向下相容
- **WHEN** 請求不帶 X-Request-Scope header
- **THEN** middleware SHALL 正常通過（admin/CLI 操作不受影響）
