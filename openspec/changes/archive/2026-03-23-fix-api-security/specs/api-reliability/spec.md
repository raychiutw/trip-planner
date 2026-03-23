## ADDED Requirements

### Requirement: restaurants POST 使用正確的 entry_id FK
`POST /api/trips/:id/entries/:eid/restaurants` 的 INSERT 語句 SHALL 使用 `entry_id` 欄位而非 `parent_type/parent_id`。sort_order 的 MAX 查詢 SHALL 使用 `WHERE entry_id = ?`。

#### Scenario: 新增餐廳成功
- **WHEN** POST 帶有 `{ name: "拉麵店" }` 到 `/api/trips/trip1/entries/1/restaurants`
- **THEN** 系統 SHALL INSERT 到 `restaurants` 表，`entry_id` = 1
- **THEN** 回傳 201 包含新建的餐廳資料

#### Scenario: sort_order 自動遞增
- **WHEN** entry 1 已有 2 筆餐廳（sort_order 0, 1）
- **THEN** 新增的餐廳 SHALL 取得 sort_order = 2

### Requirement: days PUT 原子寫入
`PUT /api/trips/:id/days/:num` 的所有資料庫操作 SHALL 盡量合併為最少次數的 `db.batch()` 呼叫，降低部分失敗導致資料不一致的風險。

#### Scenario: 完整覆寫一天資料
- **WHEN** PUT body 包含 hotel + 3 個 entries（各帶 restaurants/shopping）
- **THEN** 系統 SHALL 先 batch 刪除所有舊子資料並 INSERT hotel + entries
- **THEN** 再 batch INSERT 所有 restaurants + shopping
- **THEN** 總共不超過 2 次 batch 呼叫

#### Scenario: 第二段 batch 失敗時保留 snapshot
- **WHEN** 第二段 batch（restaurants/shopping INSERT）失敗
- **THEN** audit_log 中 SHALL 已有寫入前的完整 snapshot，可供手動恢復

### Requirement: audit_log nullish coercion 修正
`_audit.ts` 的 `logAudit` 函式 SHALL 使用 `??` 運算子取代 `||`，避免 falsy 值（0、空字串）被錯誤轉為 null。

#### Scenario: requestId 為 0
- **WHEN** `opts.requestId` = 0
- **THEN** 寫入 audit_log 的 `request_id` SHALL 為 0（非 null）

#### Scenario: diffJson 為空字串
- **WHEN** `opts.diffJson` = ""
- **THEN** 寫入 audit_log 的 `diff_json` SHALL 為 ""（非 null）

### Requirement: 移除重複的 hasPermission
`requests.ts` SHALL import `hasPermission` from `_auth.ts`，移除本地重複定義。

#### Scenario: 共用 hasPermission 行為一致
- **WHEN** `requests.ts` 呼叫 `hasPermission(db, email, tripId, isAdmin)`
- **THEN** SHALL 使用 `_auth.ts` 的實作，行為與其他端點一致
