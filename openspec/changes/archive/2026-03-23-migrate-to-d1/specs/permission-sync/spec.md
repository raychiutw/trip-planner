## ADDED Requirements

### Requirement: 新增權限時同步 Access policy
當 admin 透過 `POST /api/permissions` 新增 email ↔ tripId 權限時，系統 SHALL 同時將該 email 加入 Cloudflare Access manage application 的 Allow policy include 列表（若尚未存在）。

#### Scenario: 新 email 首次授權
- **WHEN** admin 新增 `new@gmail.com` 到任一行程
- **THEN** D1 permissions INSERT 成功
- **AND** Cloudflare Access policy include 列表新增 `new@gmail.com`

#### Scenario: 已存在的 email 授權新行程
- **WHEN** admin 新增 `existing@gmail.com`（已有其他行程權限）到新行程
- **THEN** D1 permissions INSERT 成功
- **AND** Access policy 不需更新（email 已在白名單中）

#### Scenario: Access API 失敗時回滾
- **WHEN** D1 INSERT 成功但 Cloudflare Access API 呼叫失敗
- **THEN** D1 INSERT SHALL 回滾（DELETE 該筆記錄）
- **AND** 回傳 500 錯誤

### Requirement: 移除權限時檢查後同步 Access policy
當 admin 透過 `DELETE /api/permissions/:id` 移除權限時，系統 SHALL 檢查該 email 是否還有其他行程權限，若無，則從 Access policy 移除。

#### Scenario: 移除後仍有其他行程
- **WHEN** admin 移除 `huiyun@gmail.com` 對行程 A 的權限，但她仍有行程 B 的權限
- **THEN** D1 DELETE 成功
- **AND** Access policy 不變動

#### Scenario: 移除後無任何行程
- **WHEN** admin 移除 `someone@gmail.com` 的最後一個行程權限
- **THEN** D1 DELETE 成功
- **AND** Access policy include 列表移除 `someone@gmail.com`

#### Scenario: Access API 失敗時回滾
- **WHEN** D1 DELETE 成功但 Access API 失敗
- **THEN** D1 DELETE SHALL 回滾（重新 INSERT 該筆記錄）
- **AND** 回傳 500 錯誤

### Requirement: GET/POST/DELETE /api/permissions 僅 admin 可操作
`/api/permissions*` 所有 endpoints SHALL 驗證呼叫者為 admin（JWT email === ADMIN_EMAIL 環境變數）。

#### Scenario: admin 操作
- **WHEN** admin email 呼叫 permissions API
- **THEN** 正常執行

#### Scenario: 非 admin 操作
- **WHEN** 非 admin email 呼叫 permissions API
- **THEN** 回傳 403
