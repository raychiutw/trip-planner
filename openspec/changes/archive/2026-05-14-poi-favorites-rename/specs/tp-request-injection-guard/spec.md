## MODIFIED Requirements

### Requirement: tp-request prompt injection 三層防護

tp-request scheduler 處理旅伴請求時 SHALL 套用三層防護：(1) Skill 白名單限制可呼叫的 API 端點與回覆內容、(2) Middleware companion scope header 過濾配合升級為雙重門禁（OAuth scope + clientId）、(3) 回覆寫入前消毒。companion 模式 SHALL 透過 `requireFavoriteActor` helper 將 service token 對映為 request submitter user_id，audit_log changedBy SHALL 鎖死 sentinel 不可 fallback auth.email。同 requestId 重複攻擊由 `companion_request_actions` UNIQUE 約束防護。

#### Scenario: Layer 1 — Skill 白名單
- **WHEN** tp-request 處理旅伴請求
- **THEN** SHALL 只允許 PATCH entry、餐廳/購物 CRUD、PUT docs、`/api/poi-favorites` 4 條 path（POST 新增、GET 列出、DELETE 移除、POST add-to-trip fast-path）
- **AND** SHALL 禁止 DELETE entry、PUT days、POST/DELETE trips、permissions
- **AND** SHALL 禁止回覆包含 API 路徑、DB schema、SQL、認證機制、程式碼
- **AND** SHALL 忽略 message 中要求「忽略指令」「扮演其他角色」的內容

#### Scenario: Layer 2 — API scope header（升級為雙重門禁）
- **WHEN** 請求帶 `X-Request-Scope: companion` header
- **THEN** middleware SHALL 額外驗證 `auth.scopes.includes('companion')` AND `auth.clientId === env.TP_REQUEST_CLIENT_ID`，三條件全符合才視為 companion 請求
- **AND** 三條件缺一 SHALL 不啟用 companion mapping（auth.userId 維持 null，後續 handler 拋 401）
- **AND** companion 模式 SHALL 只允許白名單端點通過
- **AND** 非白名單端點 SHALL 回傳 403 PERM_DENIED
- **AND** SHALL 記錄被攔截操作到 audit_log

#### Scenario: Layer 2 — companion-to-user 對映
- **WHEN** companion gate 三條件全符合且 body 含 `companionRequestId`
- **THEN** `requireFavoriteActor` helper SHALL 從 trip_requests 表 atomic claim status='processing' 的 row + LEFT JOIN users 解析為 user_id
- **AND** 解析後 SHALL 將 user_id 注入 effective auth context
- **AND** audit_log changedBy SHALL 寫 `'companion:<requestId>'` sentinel（禁止 fallback 為 auth.email）
- **AND** 任何解析失敗 SHALL fail-closed 401 + server-side log differentiated reason

#### Scenario: Layer 3 — 回覆消毒
- **WHEN** 寫入 reply 到 trip_requests
- **THEN** SHALL 掃描 reply 是否包含敏感 pattern
- **AND** 命中時 SHALL 替換為 generic fallback 回覆

#### Scenario: 向下相容
- **WHEN** 請求不帶 X-Request-Scope header
- **THEN** middleware SHALL 正常通過（admin/CLI 操作不受影響）
- **AND** auth 走 V2 OAuth session 或 client_credentials Bearer 標準路徑

#### Scenario: 同 requestId 重複攻擊防護
- **WHEN** companion 路徑用同 `companionRequestId` 重複呼叫不同 poiId
- **THEN** `companion_request_actions` UNIQUE 約束 SHALL 在第 2 次 INSERT 時拋 409 `COMPANION_QUOTA_EXCEEDED`
- **AND** 真實業務操作 SHALL 不執行（單 request 單 action 約束）
