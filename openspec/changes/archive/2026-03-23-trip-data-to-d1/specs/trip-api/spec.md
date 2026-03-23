## ADDED Requirements

### Requirement: GET /api/trips 列出行程
系統 SHALL 提供行程列表 API，回傳所有 published 行程（或 admin 回傳全部含未上架）。

#### Scenario: 公開查詢
- **WHEN** 未認證使用者 GET /api/trips
- **THEN** 回傳所有 published=1 的行程 [{id, name, owner, title, selfDrive, countries, published}]

#### Scenario: admin 查詢
- **WHEN** admin GET /api/trips?all=1
- **THEN** 回傳所有行程（含 published=0）

### Requirement: GET /api/trips/:id 行程詳情
系統 SHALL 回傳行程 meta 資訊，包含 footer、autoScrollDates 等。

#### Scenario: 有效 tripId
- **WHEN** GET /api/trips/okinawa-trip-2026-Ray
- **THEN** 回傳完整 meta JSON

#### Scenario: 不存在的 tripId
- **WHEN** GET /api/trips/not-exist
- **THEN** 回傳 404

### Requirement: GET /api/trips/:id/days/:num 完整一天
系統 SHALL 回傳一天的完整資料，包含 day meta、hotel（含 shopping + parking）、timeline entries（含 restaurants + shopping），JSON 結構與現有 dist/day-N.json 對齊。

#### Scenario: 正常查詢
- **WHEN** GET /api/trips/okinawa-trip-2026-Ray/days/3
- **THEN** 回傳 { id, date, dayOfWeek, label, weather, hotel: {...}, timeline: [{time, title, body, restaurants:[], shopping:[], ...}] }

### Requirement: PUT /api/trips/:id/days/:num 覆寫整天
系統 SHALL 接受完整一天的 JSON，以事務方式更新 day + hotel + entries + restaurants + shopping。需 admin 權限。

#### Scenario: 覆寫成功
- **WHEN** admin PUT 完整一天 JSON
- **THEN** 刪除該天所有舊 entries/restaurants/shopping，INSERT 新資料
- **AND** 每筆異動寫入 audit_log

### Requirement: PATCH /api/trips/:id/entries/:eid 修改 entry
系統 SHALL 接受部分欄位更新單一 entry。需 admin 權限。

#### Scenario: 修改 rating
- **WHEN** PATCH { rating: 4.5 }
- **THEN** 只更新 rating 欄位，其他不變
- **AND** audit_log 記錄 diff

### Requirement: POST/PATCH/DELETE restaurants
系統 SHALL 提供餐廳的 CRUD API。POST 掛在 entry 下新增，PATCH 修改，DELETE 刪除。

#### Scenario: 新增餐廳
- **WHEN** POST /api/trips/:id/entries/:eid/restaurants { name, category, ... }
- **THEN** INSERT 並回傳完整 row

#### Scenario: 刪除餐廳
- **WHEN** DELETE /api/trips/:id/restaurants/:rid
- **THEN** 刪除並記 audit_log（含 snapshot）

### Requirement: POST/PATCH/DELETE shopping
系統 SHALL 提供購物點的 CRUD API，支援掛在 hotel 或 entry 下。

#### Scenario: 新增 hotel 附近購物
- **WHEN** POST /api/trips/:id/hotels/:hid/shopping { name, ... }
- **THEN** INSERT（parent_type='hotel', parent_id=hid）

### Requirement: GET/PUT /api/trips/:id/docs/:type 文件
系統 SHALL 提供 trip_docs 的讀寫 API。type 為 flights/checklist/backup/suggestions/emergency。

#### Scenario: 讀取 checklist
- **WHEN** GET /api/trips/:id/docs/checklist
- **THEN** 回傳 { doc_type, content, updated_at }

#### Scenario: 更新 checklist
- **WHEN** PUT { content: "..." }
- **THEN** 更新 content 並記 audit_log

### Requirement: 三層存取控制
GET /api/trips/** SHALL 公開存取（不需認證）。寫入操作（PUT/PATCH/DELETE/POST）SHALL 需 Zero Trust 團隊成員身份（有效的 CF_Authorization JWT）。管理操作（/api/permissions/**、audit rollback）SHALL 僅 admin。

#### Scenario: 公開讀取
- **WHEN** 未認證 GET /api/trips/:id/days/1
- **THEN** 正常回傳 200

#### Scenario: Zero Trust 成員寫入
- **WHEN** 已登入 Zero Trust 的團隊成員 PATCH /api/trips/:id/entries/1
- **THEN** 正常執行更新

#### Scenario: 未認證寫入
- **WHEN** 未認證 PATCH /api/trips/:id/entries/1
- **THEN** 回傳 401

#### Scenario: 一般成員嘗試管理操作
- **WHEN** 非 admin 的 Zero Trust 成員 POST /api/trips/:id/audit/:aid/rollback
- **THEN** 回傳 403
