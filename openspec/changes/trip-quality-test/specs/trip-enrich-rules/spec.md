## MODIFIED Requirements

### Requirement: R3 餐廳推薦品質（修改數量規則）

#### Scenario: 餐廳數量上限（修改）
- **WHEN** 某 restaurants infoBox 的 `restaurants` 陣列
- **THEN** 數量 SHALL ≥ 1 且 ≤ 3
- **AND** 使用者已提供的餐廳資料優先保留，不強制補到 3 家
- **AND** 若使用者未提供任何餐廳，SHALL 補到 3 家

#### Scenario: category 對齊偏好順序（釐清）
- **WHEN** restaurants infoBox 含多家餐廳
- **THEN** 餐廳陣列中各家的 `category` SHALL 依序對應 `meta.foodPreferences` index 0、1、2
- **AND** 若 `meta.foodPreferences` 不存在或為空，則不限制 category 順序
