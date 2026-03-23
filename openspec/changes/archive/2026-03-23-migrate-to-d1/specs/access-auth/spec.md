## ADDED Requirements

### Requirement: Cloudflare Access Application — manage
系統 SHALL 設定一個 Access Application 保護 `/manage/*`、`/api/requests*`、`/api/my-trips` 路徑，認證方式為 Email OTP + Google 登入。

#### Scenario: 未認證使用者存取 manage
- **WHEN** 未認證使用者存取 `/manage/`
- **THEN** Cloudflare Access 攔截並顯示登入頁面（Email OTP 或 Google）

#### Scenario: 認證後存取
- **WHEN** 使用者通過 Access 認證
- **THEN** 設定 `CF_Authorization` JWT cookie，導回原始頁面
- **AND** Session duration 為 7 天

### Requirement: Cloudflare Access Application — admin
系統 SHALL 設定一個 Access Application 保護 `/admin/*`、`/api/permissions*` 路徑，僅允許管理者 email。

#### Scenario: 管理者存取 admin
- **WHEN** 管理者 email 存取 `/admin/`
- **THEN** 通過認證，可正常使用

#### Scenario: 非管理者存取 admin
- **WHEN** 非管理者 email 存取 `/admin/`
- **THEN** Access 拒絕存取，顯示 403

### Requirement: Service Token for CLI
系統 SHALL 建立一組 Service Token，供 `/tp-request` CLI 使用，可存取 `/api/requests*` endpoints。

#### Scenario: CLI 使用 Service Token
- **WHEN** tp-request 帶 `CF-Access-Client-Id` + `CF-Access-Client-Secret` header 呼叫 API
- **THEN** Access 閘門放行，不需 email 認證

### Requirement: Access policy 白名單包含所有旅伴
manage Access Application 的 Allow policy SHALL 包含所有在 D1 permissions table 中有記錄的 email。此清單由 admin 頁面的 permission-sync 功能自動維護。

#### Scenario: 白名單內的 email
- **WHEN** 白名單內的 email 嘗試登入 /manage/
- **THEN** 認證通過（輸入 OTP 或 Google 登入後）

#### Scenario: 白名單外的 email
- **WHEN** 白名單外的 email 嘗試登入 /manage/
- **THEN** Access 拒絕，顯示「你無權存取此應用程式」
