## ADDED Requirements

### Requirement: audit_log table
系統 SHALL 建立 `audit_log` table，包含 id(PK)、trip_id、table_name、record_id、action('insert'|'update'|'delete')、changed_by、request_id（nullable）、diff_json、snapshot、created_at 欄位。

#### Scenario: 記錄 update
- **WHEN** 更新 entry#42 的 rating 從 4.2 到 4.5
- **THEN** audit_log INSERT 一筆：table_name='entries', record_id=42, action='update', diff_json='{"rating":{"old":4.2,"new":4.5}}'

#### Scenario: 記錄 delete
- **WHEN** 刪除 restaurant#101
- **THEN** audit_log INSERT 一筆：action='delete', snapshot=刪除前的完整 row JSON

#### Scenario: 記錄 insert
- **WHEN** 新增 restaurant
- **THEN** audit_log INSERT 一筆：action='insert', diff_json 包含所有新欄位值

### Requirement: 自動寫入
所有寫入 API（PUT/PATCH/DELETE/POST）SHALL 在修改資料時自動寫入 audit_log，不需手動呼叫。

#### Scenario: PATCH entry 自動記錄
- **WHEN** PATCH /api/trips/:id/entries/:eid 修改任何欄位
- **THEN** audit_log 自動產生一筆記錄

### Requirement: 查詢修改歷史
系統 SHALL 提供 GET /api/trips/:id/audit 查詢該行程的修改歷史，支援 limit 和 request_id 篩選。僅 admin 可存取。

#### Scenario: 查全部歷史
- **WHEN** admin GET /api/trips/:id/audit?limit=20
- **THEN** 回傳最近 20 筆 audit_log，按 created_at DESC

#### Scenario: 查特定請求的改動
- **WHEN** admin GET /api/trips/:id/audit?request_id=5
- **THEN** 回傳 tp-request 處理第 5 號請求時產生的所有 audit 記錄

### Requirement: 回滾
系統 SHALL 提供 POST /api/trips/:id/audit/:aid/rollback，用 snapshot 還原被刪除的資料，或用 diff_json 反向更新。僅 admin 可操作。

#### Scenario: 回滾 delete
- **WHEN** POST rollback 一筆 action='delete' 的 audit
- **THEN** 用 snapshot 重新 INSERT 該 row

#### Scenario: 回滾 update
- **WHEN** POST rollback 一筆 action='update' 的 audit
- **THEN** 用 diff_json 的 old 值更新回原本的值
