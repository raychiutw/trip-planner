## ADDED Requirements

### Requirement: R11 地圖導航完整性

所有景點、餐廳、加油站 SHALL 包含 location 欄位，確保使用者可直接開啟地圖導航。location 物件 SHALL 遵循 MapLocation 統一型別。

#### Scenario: timeline event 須有 location

- **WHEN** timeline event 為實體地點（非交通、非餐廳未定、非純描述事件）
- **THEN** SHALL 包含 `locations[]` 陣列，至少一個 MapLocation 物件

#### Scenario: restaurant 須有 location

- **WHEN** restaurants infoBox 中的任一餐廳
- **THEN** SHALL 包含 `location` 物件（MapLocation 型別）

#### Scenario: gasStation 須有 location

- **WHEN** gasStation infoBox 存在
- **THEN** SHALL 包含 `location` 物件（MapLocation 型別）

#### Scenario: shop location 為建議性

- **WHEN** shopping infoBox 中的任一 shop
- **THEN** SHOULD 包含 `location` 物件，但不強制（現有資料填寫率不足，以 warn 模式提醒）

#### Scenario: 驗證模式為 warn

- **WHEN** 執行 R11 品質規則驗證
- **THEN** 缺少 location 的項目 SHALL 以 `console.warn` 輸出警告，不阻擋測試通過
- **AND** 待資料補齊後可升級為 strict `expect` 模式

## MODIFIED Requirements

### Requirement: R10 還車加油站

自駕行程產生或修改還車 timeline event 時，SHALL 附上最近的加油站資訊。優先推薦フルサービス（人工加油站）。加油站以 `gasStation` infoBox 結構化呈現，欄位直接位於 infoBox 頂層（扁平結構），包含名稱、地址、營業時間、服務類型（人工/自助）、電話。

#### Scenario: 新增還車事件

- **WHEN** 為自駕行程新增還車 timeline event
- **THEN** SHALL 搜尋還車店鋪附近的加油站（Google「{還車地點} 附近 人工加油站」），以 `gasStation` infoBox 附上

#### Scenario: 人工優先

- **WHEN** 推薦加油站
- **THEN** SHALL 優先選擇フルサービス（人工加油站），標註 `service: "フルサービス（人工）"`
- **AND** 若附近僅有自助加油站，標註 `service: "セルフ（自助）"`

#### Scenario: 必填資訊

- **WHEN** 新增 gasStation infoBox
- **THEN** SHALL 填寫 `name`、`address`、`hours`、`service`、`phone`、`location`（MapLocation 物件，含 googleQuery / appleQuery），所有欄位直接位於 infoBox 頂層

#### Scenario: gasStation 扁平結構

- **WHEN** 新增或修改 gasStation infoBox
- **THEN** SHALL 不使用 `station` wrapper，所有欄位（name、address、hours、service、phone、location）直接位於 infoBox 頂層
