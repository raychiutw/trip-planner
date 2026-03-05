## ADDED Requirements

### Requirement: 行程 JSON 修改前備份

所有修改行程 JSON 的 skill SHALL 在修改前將原始檔案備份到 `data/backup/` 目錄。備份檔案 SHALL 簽入版控。

#### Scenario: 備份觸發

- **WHEN** tp-rebuild、tp-edit、tp-issue 即將修改 `data/trips/{tripSlug}.json`
- **THEN** SHALL 先複製該檔案到 `data/backup/{tripSlug}_{timestamp}.json`

#### Scenario: 備份命名格式

- **WHEN** 產生備份檔案
- **THEN** 檔名 SHALL 為 `{tripSlug}_{YYYY-MM-DDTHHMMSS}.json`
- **AND** 時間戳 SHALL NOT 包含 `:` 字元（Windows 檔名限制）

#### Scenario: 備份目錄自動建立

- **WHEN** `data/backup/` 目錄不存在
- **THEN** SHALL 自動建立

#### Scenario: 備份保留上限

- **WHEN** 同一 tripSlug 的備份超過 10 份
- **THEN** SHALL 刪除最舊的備份，保留最新 10 份

#### Scenario: 備份簽入版控

- **WHEN** 備份檔案存在於 `data/backup/`
- **THEN** SHALL 隨行程修改一同 commit 進 git 版本控制

### Requirement: .gitignore 更新

`.gitignore` SHALL 包含排程 log 的排除規則。

#### Scenario: 排除排程 log

- **WHEN** `.gitignore` 存在
- **THEN** SHALL 包含 `scripts/*.log` 規則
