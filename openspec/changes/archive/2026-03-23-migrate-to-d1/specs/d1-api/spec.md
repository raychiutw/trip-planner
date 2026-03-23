## ADDED Requirements

### Requirement: D1 database schema
系統 SHALL 在 Cloudflare D1 建立 `requests` 和 `permissions` 兩張 table，schema 如 design.md 所定義。`requests` 儲存旅伴請求與回覆，`permissions` 儲存 email ↔ tripId 授權對應。

#### Scenario: Database 初始化
- **WHEN** D1 database 建立並執行 migration
- **THEN** `requests` table 包含 id、trip_id、mode、title、body、submitted_by、reply、status、created_at 欄位
- **AND** `permissions` table 包含 id、email、trip_id、role 欄位，且 (email, trip_id) 為 UNIQUE

### Requirement: GET /api/requests 列出請求
系統 SHALL 提供 `GET /api/requests` endpoint，支援 `tripId` 和 `status` query parameter 篩選，回傳 JSON 陣列，按 created_at DESC 排序，上限 50 筆。

#### Scenario: 依 tripId 查詢
- **WHEN** 已認證使用者呼叫 `GET /api/requests?tripId=okinawa-trip-2026-Ray`
- **THEN** 回傳該 tripId 的所有 requests，status 200

#### Scenario: 依 tripId + status 查詢
- **WHEN** 呼叫 `GET /api/requests?tripId=xxx&status=open`
- **THEN** 僅回傳 status 為 open 的 requests

#### Scenario: 無權限的 tripId
- **WHEN** 使用者查詢無權限的 tripId
- **THEN** 回傳 403

### Requirement: POST /api/requests 建立請求
系統 SHALL 提供 `POST /api/requests` endpoint，接受 JSON body `{ tripId, mode, title, body }`，寫入 D1 後回傳完整 row（含自動填入的 id、submitted_by、created_at），status 201。

#### Scenario: 成功建立請求
- **WHEN** 已認證使用者 POST `{ tripId: "xxx", mode: "trip-edit", title: "改餐廳", body: "..." }`
- **THEN** D1 INSERT 成功，submitted_by 從 JWT email 自動填入
- **AND** 回傳完整 row，status 201

#### Scenario: 寫入後立即可讀
- **WHEN** POST 建立請求成功後，立即 GET 同一 tripId
- **THEN** 回傳結果 SHALL 包含剛建立的請求

#### Scenario: 無權限的 tripId
- **WHEN** 使用者 POST 到無權限的 tripId
- **THEN** 回傳 403，不寫入

### Requirement: PATCH /api/requests/:id 更新請求
系統 SHALL 提供 `PATCH /api/requests/:id` endpoint，接受 `{ reply, status }` 用於 Claude 回覆並關閉請求。

#### Scenario: 回覆並關閉
- **WHEN** Service Token 呼叫 `PATCH /api/requests/123 { reply: "已修改...", status: "closed" }`
- **THEN** 該 request 的 reply 和 status 更新

### Requirement: GET /api/my-trips 取得有權行程
系統 SHALL 提供 `GET /api/my-trips` endpoint，從 JWT email 查詢 permissions table，回傳使用者有權限的 tripId 列表。

#### Scenario: 有多個行程權限
- **WHEN** huiyun@gmail.com 有 okinawa-Ray 和 okinawa-HuiYun 兩個行程權限
- **THEN** 回傳 `[{ tripId: "okinawa-trip-2026-Ray" }, { tripId: "okinawa-trip-2026-HuiYun" }]`

#### Scenario: 無任何權限
- **WHEN** 使用者通過 Access 認證但 permissions 無任何記錄
- **THEN** 回傳空陣列 `[]`

### Requirement: JWT 驗證 middleware
所有 `/api/*` endpoints SHALL 從 `CF_Authorization` cookie 解析 JWT，取得使用者 email。Service Token 請求（帶 `CF-Access-Client-Id` header）SHALL 被視為 admin 權限。

#### Scenario: 有效 JWT
- **WHEN** 請求帶有效的 CF_Authorization cookie
- **THEN** 解析出 email，傳入 handler

#### Scenario: Service Token
- **WHEN** 請求帶 CF-Access-Client-Id + CF-Access-Client-Secret header
- **THEN** 視為 admin 權限，允許操作所有 tripId

#### Scenario: 無認證
- **WHEN** 請求無 cookie 且無 Service Token header
- **THEN** 回傳 401
