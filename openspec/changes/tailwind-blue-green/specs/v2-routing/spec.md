## ADDED Requirements

### Requirement: V1/V2 路由切換機制
main.tsx SHALL 支援透過 query string 和 localStorage 在 V1 和 V2 元件之間切換。

#### Scenario: 預設載入 V1
- **WHEN** 使用者訪問頁面，無任何 query string 或 localStorage 設定
- **THEN** SHALL 載入 V1 版本元件

#### Scenario: query string v2=1 啟用 V2
- **WHEN** URL 包含 `?v2=1`
- **THEN** SHALL 載入 V2 版本元件

#### Scenario: query string v1=1 強制回退 V1
- **WHEN** URL 包含 `?v1=1`，即使 localStorage 設定為 V2
- **THEN** SHALL 載入 V1 版本元件（v1=1 優先級最高）

#### Scenario: localStorage 持久化 V2 選擇
- **WHEN** localStorage `tripline-v2` 值為 `'1'`，且無 query string override
- **THEN** SHALL 載入 V2 版本元件

### Requirement: V1/V2 code splitting 隔離
V1 和 V2 元件 SHALL 使用 `React.lazy` 分別載入，確保使用者只下載當前使用版本的 JavaScript。

#### Scenario: V1 使用者不下載 V2 程式碼
- **WHEN** useV2 為 false
- **THEN** V2 元件的 JavaScript chunk SHALL NOT 被載入

#### Scenario: V2 使用者不下載 V1 程式碼
- **WHEN** useV2 為 true
- **THEN** V1 元件的 JavaScript chunk SHALL NOT 被載入

### Requirement: Cloudflare Access redirect 保留 query string
`?v2=1` SHALL 在 Cloudflare Access 登入 redirect 後仍然有效。

#### Scenario: Access redirect 後 v2=1 仍有效
- **WHEN** 未登入使用者訪問 `/manage?v2=1` 並完成 Access 登入
- **THEN** redirect 回 `/manage?v2=1`，SHALL 載入 V2 版本
