## ADDED Requirements

### Requirement: R10 還車加油站
自駕行程產生或修改還車 timeline event 時，SHALL 附上最近的加油站資訊。優先推薦フルサービス（人工加油站）。加油站以 `gasStation` infoBox 結構化呈現，包含名稱、地址、營業時間、服務類型（人工/自助）、電話。

#### Scenario: 新增還車事件
- **WHEN** 為自駕行程新增還車 timeline event
- **THEN** SHALL 搜尋還車店鋪附近的加油站（Google「{還車地點} 附近 人工加油站」），以 `gasStation` infoBox 附上

#### Scenario: 人工優先
- **WHEN** 推薦加油站
- **THEN** SHALL 優先選擇フルサービス（人工加油站），標註 `service: "フルサービス（人工）"`
- **AND** 若附近僅有自助加油站，標註 `service: "セルフ（自助）"`

#### Scenario: 必填資訊
- **WHEN** 新增 gasStation infoBox
- **THEN** SHALL 填寫 `name`、`address`、`hours`、`service`、`phone`，並盡可能附上 `location`（含 googleQuery / appleQuery）
