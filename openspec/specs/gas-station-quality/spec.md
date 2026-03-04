## ADDED Requirements

### Requirement: meta.tripType 欄位
每個行程 JSON 的 `meta` SHALL 包含 `tripType` 欄位，標示行程交通類型。

#### Scenario: 自駕行程
- **WHEN** 行程全程自駕
- **THEN** `meta.tripType` SHALL 為 `"self-drive"`

#### Scenario: 大眾運輸行程
- **WHEN** 行程全程使用大眾運輸
- **THEN** `meta.tripType` SHALL 為 `"transit"`

#### Scenario: 混合行程
- **WHEN** 行程部分自駕部分大眾運輸
- **THEN** `meta.tripType` SHALL 為 `"mixed"`

#### Scenario: /render-trip 無法判斷時提問
- **WHEN** `/render-trip` 處理新行程且 `meta.tripType` 不存在
- **AND** 無法從行程內容推斷交通類型
- **THEN** SHALL 提問使用者選擇 tripType

### Requirement: gasStation infoBox type
自駕行程還車事件 SHALL 使用 `gasStation` type 的 infoBox 提供加油站資訊。

#### Scenario: gasStation 結構
- **WHEN** infoBox `type` 為 `gasStation`
- **THEN** SHALL 包含 `station` 物件，必填欄位：`name`（名稱）、`address`（地址）、`hours`（營業時間）、`service`（服務類型：人工/自助）、`phone`（電話）
- **AND** 選填欄位：`location`（Location 物件，含 googleQuery / appleQuery）

#### Scenario: 人工加油站優先
- **WHEN** 推薦加油站
- **THEN** SHALL 優先選擇フルサービス（人工加油站），若附近無人工加油站才選自助

### Requirement: R10 還車加油站品質規則
自駕行程（`meta.tripType` 為 `"self-drive"` 或 `"mixed"`）的還車 timeline event SHALL 包含 gasStation infoBox。

#### Scenario: 自駕行程有還車事件
- **WHEN** `meta.tripType` 為 `"self-drive"` 或 `"mixed"`
- **AND** timeline 中有 event title 包含「還車」
- **THEN** 該 event 的 infoBoxes SHALL 包含至少一個 `type: "gasStation"` 的 infoBox

#### Scenario: 非自駕行程不檢查
- **WHEN** `meta.tripType` 為 `"transit"`
- **THEN** SHALL 不檢查還車加油站

#### Scenario: 無還車事件不檢查
- **WHEN** timeline 中沒有 title 包含「還車」的 event
- **THEN** SHALL 不檢查加油站
