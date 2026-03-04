## ADDED Requirements

### Requirement: meta.tripType schema 驗證
Schema 驗證 SHALL 確認 `meta.tripType` 欄位存在且值有效。

#### Scenario: tripType 必填
- **WHEN** 驗證任一行程 JSON
- **THEN** `meta.tripType` SHALL 存在

#### Scenario: tripType 值驗證
- **WHEN** `meta.tripType` 存在
- **THEN** 值 SHALL 為 `"self-drive"`、`"transit"` 或 `"mixed"` 之一

### Requirement: gasStation infoBox schema 驗證
Schema 驗證 SHALL 確認 `gasStation` infoBox 結構正確。

#### Scenario: gasStation 必填欄位
- **WHEN** infoBox `type` 為 `gasStation`
- **THEN** SHALL 確認包含 `station` 物件
- **AND** `station` SHALL 包含必填欄位：`name`（字串）、`address`（字串）、`hours`（字串）、`service`（字串）、`phone`（字串）

#### Scenario: gasStation 選填欄位
- **WHEN** `station` 包含 `location`
- **THEN** location SHALL 為有效 Location 物件（含 `name`、`googleQuery`、`appleQuery`）

### Requirement: R10 還車加油站 quality 驗證
Quality 驗證 SHALL 確認自駕行程的還車事件包含加油站資訊。

#### Scenario: 自駕行程還車須有加油站
- **WHEN** `meta.tripType` 為 `"self-drive"` 或 `"mixed"`
- **AND** 某日 timeline 有 event title 包含「還車」
- **THEN** 該 event 的 infoBoxes SHALL 包含至少一個 `type: "gasStation"`

#### Scenario: transit 行程不檢查
- **WHEN** `meta.tripType` 為 `"transit"`
- **THEN** SHALL 跳過 R10 檢查
