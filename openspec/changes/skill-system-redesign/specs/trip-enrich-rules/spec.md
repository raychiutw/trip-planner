## MODIFIED Requirements

### Requirement: tp-rebuild 品質檢查整合

`/tp-rebuild` 全面重整單一行程 JSON 時，SHALL 在修正前後各執行一次 tp-check 品質驗證 report。修正前的 report 用於識別需修正項目，修正後的 report 用於確認修正結果。

#### Scenario: 修正前 tp-check

- **WHEN** `/tp-rebuild {tripSlug}` 開始執行
- **THEN** SHALL 先執行 tp-check 完整模式（before-fix report）
- **AND** 顯示完整 report 供參照

#### Scenario: 修正後 tp-check

- **WHEN** `/tp-rebuild` 完成所有 R1-R12 修正
- **THEN** SHALL 再執行一次 tp-check 完整模式（after-fix report）
- **AND** 顯示完整 report 確認修正結果

#### Scenario: tp-rebuild-all 整合

- **WHEN** `/tp-rebuild-all` 逐趟執行重整
- **THEN** 每趟完成後 SHALL 執行一次 tp-check 完整模式（after-fix report）

#### Scenario: 修正前備份

- **WHEN** `/tp-rebuild` 即將修改行程 JSON
- **THEN** SHALL 先執行備份流程（見 trip-json-backup spec）
