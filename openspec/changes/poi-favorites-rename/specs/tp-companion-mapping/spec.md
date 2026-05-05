## ADDED Requirements

### Requirement: companion gate 雙重門禁

middleware SHALL 在 `X-Request-Scope: companion` header 出現時，額外驗證 OAuth scope 與 clientId 才視為 companion 請求。具體 gate：`(scope === 'companion' && auth.scopes.includes('companion') && auth.clientId === env.TP_REQUEST_CLIENT_ID)`。三條件缺一 SHALL 不啟用 companion mapping。

#### Scenario: Self-reported header without OAuth scope
- **WHEN** 攻擊者持 valid Bearer token（admin scope 但無 companion scope）+ 加 `X-Request-Scope: companion` header
- **THEN** companion mapping SHALL NOT 啟用
- **AND** auth.userId SHALL 維持原本 null（service token）
- **AND** server SHALL 寫 audit_log `companion_failure_reason: 'self_reported_scope'`

#### Scenario: Wrong clientId
- **WHEN** Bearer token 含 companion scope 但 clientId 非 `env.TP_REQUEST_CLIENT_ID`
- **THEN** companion mapping SHALL NOT 啟用
- **AND** server SHALL 寫 audit_log `companion_failure_reason: 'client_unauthorized'`

#### Scenario: 三條件全符合
- **WHEN** Bearer token clientId === TP_REQUEST_CLIENT_ID + scopes 含 'companion' + header `X-Request-Scope: companion`
- **THEN** middleware SHALL 啟用 companion mapping 流程

### Requirement: companion 從 body.companionRequestId 解析 user_id

API helper `requireFavoriteActor(context, body)` SHALL 在 companion 模式下從 `body.companionRequestId` 查 trip_requests 表並 atomic claim status，再透過 submitted_by email 對映 users.id。失敗任何一步 SHALL fail-closed 拋 401 `AUTH_REQUIRED`。SQL 必為 guarded claim：`UPDATE trip_requests SET status='processing' WHERE id=? AND status='processing' RETURNING submitted_by`。

#### Scenario: 成功解析
- **WHEN** body.companionRequestId 對應 trip_requests row 存在 + status='processing' + submitted_by 對應有效 users.email
- **THEN** helper SHALL 回 `{ userId: users.id, isCompanion: true, requestId, audit: { changedBy: 'companion:<id>', tripId: 'system:companion' } }`

#### Scenario: requestId 缺失或型別錯
- **WHEN** body 缺 companionRequestId 或值非正整數
- **THEN** helper SHALL fail-closed
- **AND** server 寫 audit_log `companion_failure_reason: 'invalid_request_id'`
- **AND** API 拋 401 `AUTH_REQUIRED`

#### Scenario: requestId 不存在
- **WHEN** body.companionRequestId 對應 trip_requests 無 row
- **THEN** UPDATE RETURNING 回 0 rows
- **AND** helper SHALL fail-closed 拋 401（不暴露「row 不存在」資訊）

#### Scenario: status 不是 processing
- **WHEN** trip_requests row 存在但 status='completed' 或 'open'
- **THEN** UPDATE WHERE 條件不符 → RETURNING 回 0 rows
- **AND** helper SHALL fail-closed 拋 401
- **AND** server 寫 audit_log `companion_failure_reason: 'status_completed'`

#### Scenario: submitted_by email 沒對應 users
- **WHEN** trip_requests.submitted_by 是 'unknown@example.com' 但 users 表無此 email
- **THEN** LEFT JOIN users.id 為 null
- **AND** helper SHALL fail-closed 拋 401
- **AND** server 寫 audit_log `companion_failure_reason: 'submitter_unknown'`

#### Scenario: status race 防護
- **WHEN** A 進 helper 讀 status=processing 的同時 admin PATCH 改 status=completed
- **THEN** UPDATE WHERE status='processing' 條件已不符 → RETURNING 回 0 rows
- **AND** helper SHALL fail-closed（防 TOCTOU race）

### Requirement: companion 操作單 request 單 action

companion 路徑 SHALL 在執行真實業務操作前，INSERT 一筆 `companion_request_actions(request_id, action, poi_id)`。同 request 同 action 第 2 次 INSERT 違反 UNIQUE → 409 `COMPANION_QUOTA_EXCEEDED`。

#### Scenario: 第一次 favorite_create
- **WHEN** companion 路徑首次用 requestId X POST `/api/poi-favorites`
- **THEN** 寫一筆 `companion_request_actions (X, 'favorite_create', <poiId>)` 成功
- **AND** 後續執行真實 INSERT 進 poi_favorites

#### Scenario: 第二次 favorite_create 同 request
- **WHEN** 同 requestId X 再 POST `/api/poi-favorites`（不同 poiId）
- **THEN** companion_request_actions 第 2 次 INSERT 違反 UNIQUE (X, 'favorite_create')
- **AND** API SHALL 拋 409 `COMPANION_QUOTA_EXCEEDED`
- **AND** 不執行真實 poi_favorites INSERT

#### Scenario: 同 request 不同 action 允許
- **WHEN** requestId X 先 POST favorite_create 後 POST add-to-trip
- **THEN** 兩筆 INSERT 都成功（action 欄位不同 → UNIQUE 不衝突）

### Requirement: companion rate limit bucket 隔離

`_rate_limit.ts` SHALL 對 companion 與 V2 user 使用獨立 bucket key。User web bucket：`poi-favorites-post:user:${userId}`。Companion bucket：`poi-favorites-post:companion:${requestId}`。Bucket 內部 SHALL atomic INSERT ON CONFLICT DO UPDATE（取代既有 read-then-replace race）。

#### Scenario: User web 流量不影響 companion
- **WHEN** user A 1 分鐘內 POST 第 11 次 web `/api/poi-favorites`（user bucket 滿）
- **THEN** API 回 429
- **AND** 同時間 mac mini cron POST companion path SHALL 不受影響（不同 bucket）

#### Scenario: Companion bucket 與 D4 配合
- **WHEN** 攻擊者用同 requestId 嘗試 POST 100 次
- **THEN** 第 1 次後 companion_request_actions UNIQUE 違反 → 409（D4 防護）
- **AND** rate limit bucket 同時 +1，達 quota 上限後 429（雙重防護）

#### Scenario: Atomic INSERT ON CONFLICT
- **WHEN** 100 burst concurrent POST 同 user
- **THEN** rate limit count SHALL 由 atomic SQL 計算（無 read-then-replace race underflow）

### Requirement: companion 寫入 audit_log changedBy 鎖死 sentinel

companion 路徑 INSERT/DELETE/UPDATE poi_favorites 時，audit_log SHALL 寫入 `changedBy: 'companion:<requestId>'` sentinel 字串、`tripId: 'system:companion'` sentinel。**禁止** fallback 為 auth.email（即使 service token 因 admin scope 拿到 ADMIN_EMAIL 也不可）。

#### Scenario: companion INSERT 寫 audit
- **WHEN** companion 路徑 POST 成功新增 poi_favorites row
- **THEN** audit_log SHALL 多 1 row：`tableName='poi_favorites', recordId=<id>, action='insert', changedBy='companion:<requestId>', tripId='system:companion'`

#### Scenario: companion 失敗也寫 audit
- **WHEN** companion 路徑因 status_completed 等原因 fail-closed
- **THEN** audit_log SHALL 多 1 row 描述失敗原因：`changedBy='companion:<requestId>', companion_failure_reason='status_completed'`（或對應 enum 值）

### Requirement: companion 失敗結構化 log

audit_log SHALL 加 `companion_failure_reason` field（nullable TEXT），enum 值含 `invalid_request_id` / `status_completed` / `submitter_unknown` / `self_reported_scope` / `client_unauthorized` / `quota_exceeded`。Client 維持 401 + uniform message（不暴露 oracle）。Server 透過 audit_log 可 differentiate debug。

#### Scenario: Client 收到 uniform 401
- **WHEN** companion 任何一種失敗情境
- **THEN** API response 統一 `{ error: 'AUTH_REQUIRED' }` HTTP 401
- **AND** SHALL NOT 含失敗細節（防 oracle 列舉）

#### Scenario: Server 寫 differentiated reason
- **WHEN** companion 因 submitter_unknown 失敗
- **THEN** audit_log row.companion_failure_reason = 'submitter_unknown'
- **AND** dev 從 D1 query 此 field 可定位真實原因

### Requirement: 4 個 endpoint 統一用 requireFavoriteActor helper

`functions/api/_companion.ts` SHALL exported `requireFavoriteActor(context, body)` 函式，回 `{ userId, isCompanion, requestId, audit }` 結構。`POST /api/poi-favorites`、`GET /api/poi-favorites`、`DELETE /api/poi-favorites/:id`、`POST /api/poi-favorites/:id/add-to-trip` 4 個 handler SHALL 統一使用此 helper（不重複 effective-userId 解析、bucket key、audit 組裝）。

#### Scenario: helper signature 一致
- **WHEN** 任一 endpoint 呼叫 helper
- **THEN** 回傳結構 SHALL 為 `{ userId: string | null, isCompanion: boolean, requestId: number | null, audit: { changedBy: string, tripId: string } }`

#### Scenario: GET endpoint 傳 query param
- **WHEN** GET handler 呼叫 helper（GET 沒 body）
- **THEN** helper SHALL 從 URL `?companionRequestId=N` query param 取 requestId

#### Scenario: 4 endpoint 行為一致
- **WHEN** 任一 endpoint 收到 companion 失敗情境
- **THEN** SHALL 統一拋 401 `AUTH_REQUIRED`（不分 endpoint 細節差異）

### Requirement: OAuth `companion` scope 配置

OAuth provision script `scripts/provision-admin-cli-client.js` SHALL 支援發行含 `admin + companion` 雙 scope 的 client_credentials token。新 scope `companion` SHALL 加進 OAuth 白名單。Mac mini cron client SHALL 換新 token 含此 scope。

#### Scenario: 新 token mint 含 companion scope
- **WHEN** admin 跑 provision script 帶 `--scopes admin,companion`
- **THEN** 發行的 access_token row.scopes SHALL 為 `['admin', 'companion']`

#### Scenario: 既有 admin-only token 不影響其他功能
- **WHEN** 既有 admin scope token（不含 companion）打 `/api/poi-favorites` 不帶 companion header
- **THEN** SHALL 走 V2 user-bound 路徑（auth.userId null → 401，符合既有行為）
- **AND** admin 既有 endpoint 行為不變

#### Scenario: TP_REQUEST_CLIENT_ID env binding
- **WHEN** Cloudflare Pages env 設定 `TP_REQUEST_CLIENT_ID = <mac mini cron client id>`
- **THEN** middleware SHALL 用此 env 比對 auth.clientId 作為 gate
