## ADDED Requirements

### Requirement: POST /api/trips 建立行程端點

`POST /api/trips` SHALL 建立新行程記錄，包含 trips、trip_days、trip_permissions 三張表的資料。

#### Scenario: 成功建立行程
- **WHEN** 已認證使用者 POST `/api/trips` 帶有效 body
- **THEN** SHALL 回傳 201 `{ ok: true, tripId, daysCreated }`
- **AND** SHALL INSERT trips 記錄
- **AND** SHALL INSERT trip_days 記錄（依 startDate/endDate 計算天數）
- **AND** SHALL INSERT trip_permissions（建立者為 admin）
- **AND** SHALL INSERT audit_log（action: insert）

#### Scenario: 必填欄位驗證
- **WHEN** body 缺少 id、name、owner、startDate、endDate 任一欄位
- **THEN** SHALL 回傳 400

#### Scenario: tripId 格式驗證
- **WHEN** id 不符合 `/^[a-z0-9-]+$/` 或超過 100 字元
- **THEN** SHALL 回傳 400

#### Scenario: 日期驗證
- **WHEN** startDate 或 endDate 不符合 YYYY-MM-DD 格式
- **THEN** SHALL 回傳 400
- **WHEN** endDate < startDate
- **THEN** SHALL 回傳 400

#### Scenario: 天數上限
- **WHEN** startDate 到 endDate 超過 30 天
- **THEN** SHALL 回傳 400

#### Scenario: tripId 重複
- **WHEN** id 已存在於 trips 表
- **THEN** SHALL 回傳 409

#### Scenario: 未認證
- **WHEN** 請求未帶認證 token
- **THEN** SHALL 回傳 401

#### Scenario: 原子性
- **WHEN** 建立行程
- **THEN** SHALL 使用 `db.batch()` 確保 trips + trip_days + trip_permissions + audit_log 全部成功或全部回滾

#### Scenario: trip_days 日期計算
- **WHEN** startDate=2026-07-29, endDate=2026-08-02
- **THEN** SHALL 建立 5 天（day_num 1~5）
- **AND** day_of_week SHALL 正確對應（三、四、五、六、日）

#### Scenario: 選填欄位預設值
- **WHEN** body 未包含選填欄位（title, description, self_drive, countries 等）
- **THEN** SHALL 使用合理預設值（空字串或 0），不使用 null
