## MODIFIED Requirements

### Requirement: Schema 驗證層

所有 `data/trips/*.json` SHALL 通過 Schema 驗證。Schema 層檢查欄位存在性，確保結構完整。驗證範圍涵蓋根層級欄位、每日結構、hotel 物件、timeline event、infoBox 結構。

#### Scenario: hotel 物件結構

- **WHEN** 某日包含 `hotel` 欄位
- **THEN** SHALL 確認存在必填欄位：`name`、`breakfast`（物件，含 `included` 欄位）
- **AND** 選填欄位：`url`、`blogUrl`、`details`、`checkout`、`infoBoxes` 存在時驗證結構
- **AND** `subs` 欄位 SHALL 不再是已知選填欄位（`hotel.subs[]` 已廢除）

#### Scenario: parking infoBox 結構

- **WHEN** infoBox `type` 為 `parking`
- **THEN** SHALL 確認包含 `title`（字串）
- **AND** 選填欄位：`price`（字串）、`note`（字串）、`location`（Location 物件）存在時驗證結構
