## ADDED Requirements

### Requirement: 命名規範自動驗證測試
系統 SHALL 提供 `tests/unit/naming-convention.test.js` 自動掃描 codebase 驗證命名規範。

#### Scenario: JS 可變狀態不得用 UPPER_CASE
- **WHEN** 掃描 js/*.js 中的 `var/let UPPER_CASE =` 賦值
- **THEN** 不得出現（常數用 UPPER_CASE 但必須不被重新賦值）

#### Scenario: 不得出現 t.id || t.tripId 防禦性寫法
- **WHEN** 掃描 js/*.js
- **THEN** 不得出現 `t.id || t.tripId` 或 `\.id || .*\.tripId` 模式

#### Scenario: CSS class 必須 kebab-case
- **WHEN** 掃描 css/*.css 的 class selector
- **THEN** 所有 class 名稱為 kebab-case（允許 -- BEM modifier）

#### Scenario: API response 統一用 tripId
- **WHEN** 掃描 functions/api/trips*.ts 的 SELECT 語句
- **THEN** 不得回傳裸 `id` 作為 trip identifier（應為 `id AS tripId` 或 `tripId`）

### Requirement: tp-naming skill
系統 SHALL 提供 `/tp-naming` skill，在 commit 前執行命名規範驗證。

#### Scenario: 驗證通過
- **WHEN** 所有命名規範測試通過
- **THEN** 回報綠燈

#### Scenario: 驗證失敗
- **WHEN** 有命名違規
- **THEN** 列出所有違規項目，嘗試自動修正，修正後重新驗證

### Requirement: pre-commit hook 整合
pre-commit hook SHALL 在 JS/CSS/HTML 檔案變更時執行命名規範驗證測試。

#### Scenario: 命名違規阻止 commit
- **WHEN** staged 檔案有命名規範違規
- **THEN** commit 被阻止，輸出違規清單
