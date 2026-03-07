## REMOVED Requirements

### Requirement: 行程 JSON 修改前備份（移除）
`data/backup/` 備份機制 SHALL 被移除。MD 檔案以 git 版控追蹤變更歷史，不再需要額外備份。

#### Scenario: 移除備份目錄
- **WHEN** 實作本變更
- **THEN** SHALL 刪除 `data/backup/` 目錄及所有內容

#### Scenario: Skills 不再備份
- **WHEN** tp-edit、tp-rebuild、tp-issue 即將修改行程
- **THEN** SHALL NOT 執行備份流程
- **THEN** SHALL NOT 參照 `data/backup/` 路徑

#### Scenario: .gitignore 備份規則移除
- **WHEN** `.gitignore` 包含 `data/backup/` 相關規則
- **THEN** SHALL 移除該規則（目錄已刪除）

### Requirement: .gitignore 更新（保留）
`.gitignore` SHALL 繼續包含 `scripts/*.log` 排除規則（不受本變更影響）。
