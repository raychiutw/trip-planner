## MODIFIED Requirements

### Requirement: R1 料理偏好詢問
`/render-trip` 為某行程產生餐廳推薦前，SHALL 先檢查 `meta.foodPreferences` 欄位。若已有偏好則直接使用，不再詢問。若欄位不存在，SHALL 詢問使用者料理偏好（最多 3 類，依優先排序），取得後寫入 `meta.foodPreferences` 並套用到所有餐廳推薦。後續推薦的第 1 家餐廳 SHALL 對應偏好 1、第 2 家對應偏好 2、第 3 家對應偏好 3。

#### Scenario: JSON 已有偏好
- **WHEN** `/render-trip` 讀取行程且 `meta.foodPreferences` 已存在
- **THEN** SHALL 直接使用該偏好，不詢問使用者

#### Scenario: JSON 無偏好
- **WHEN** `/render-trip` 讀取行程且 `meta.foodPreferences` 不存在
- **THEN** SHALL 詢問「有沒有特別想吃的料理類型？最多三類，依優先排序」，取得後寫入 `meta.foodPreferences` 並套用

#### Scenario: 餐廳順序對齊偏好
- **WHEN** 餐廳 infoBox 包含 3 家餐廳且行程有 `foodPreferences`
- **THEN** 第 1 家 category SHALL 盡量對應 `foodPreferences[0]`、第 2 家對應 `[1]`、第 3 家對應 `[2]`

#### Scenario: 偏好料理不可得時
- **WHEN** 當前地點附近找不到某偏好料理類型的餐廳
- **THEN** SHALL 以當地最接近的替代類型填入，category 反映實際料理類型

### Requirement: R3 餐廳推薦品質
每個 `infoBoxes[type=restaurants]` 的 `restaurants` 陣列 SHALL 補到 3 家。每家餐廳 SHALL 包含 `hours`（營業時間）、`reservation`（訂位資訊）、`blogUrl`（繁中推薦網誌）。推薦餐廳的營業時間 MUST 與用餐時間吻合。選擇依據為行程當時地點附近、評價高的餐廳。3 家餐廳的 `category` SHALL 依 `meta.foodPreferences` 順序排列（偏好 1 → 偏好 2 → 偏好 3）。

#### Scenario: 餐廳補到 3 家
- **WHEN** 某 restaurants box 不足 3 家
- **THEN** SHALL 以行程當時位置附近、評價高為條件補足到 3 家，每家依料理偏好排序

#### Scenario: 營業時間吻合
- **WHEN** 推薦午餐餐廳
- **THEN** 該餐廳的 `hours` MUST 涵蓋午餐時段（不得推薦 17:00 才開的店當午餐）

#### Scenario: 必填欄位完整
- **WHEN** 新增任一餐廳
- **THEN** SHALL 填寫 `hours`、`reservation`（需訂位/不需訂位/電話等）、`blogUrl`

#### Scenario: category 對齊偏好順序
- **WHEN** 行程有 `foodPreferences` 且 infoBox 含 3 家餐廳
- **THEN** 第 1 家 `category` SHALL 對應 `foodPreferences[0]`、第 2 家對應 `[1]`、第 3 家對應 `[2]`
