## Capability: food-preferences-field

### Overview
定義行程 JSON 中 `meta.foodPreferences` 欄位的資料結構與語意。此欄位儲存使用者的料理偏好清單，供 `/render-trip` 產生餐廳推薦時參考。

### Field Definition
位置：`meta.foodPreferences`
型別：`string[]`（字串陣列）
說明：使用者偏好的料理類型，依優先順序排列，最多 3 項。

範例：
```json
{
  "meta": {
    "foodPreferences": ["日式", "義式", "台式"]
  }
}
```

### Requirement: FP1 欄位存在時的語意
`meta.foodPreferences` 存在且為非空陣列時，SHALL 視為已知偏好，不再詢問使用者。

#### Scenario: JSON 已有偏好
- **WHEN** 行程 JSON 的 `meta.foodPreferences` 為非空陣列
- **THEN** SHALL 直接採用此陣列作為料理偏好，index 0 為第 1 優先、index 1 為第 2 優先、index 2 為第 3 優先

### Requirement: FP2 欄位缺失時的行為
`meta.foodPreferences` 不存在或為空陣列時，SHALL 詢問使用者並將回答寫回 JSON。

#### Scenario: JSON 無偏好
- **WHEN** 行程 JSON 的 `meta.foodPreferences` 不存在或為空陣列
- **THEN** SHALL 詢問使用者「有沒有特別想吃的料理類型？最多三類，依優先排序」，取得回答後 SHALL 寫回 `meta.foodPreferences`

### Requirement: FP3 偏好順序對齊餐廳排列
餐廳推薦陣列的順序 SHALL 對應 `meta.foodPreferences` 的優先順序。

#### Scenario: 餐廳順序對齊偏好
- **WHEN** 某 restaurants infoBox 包含 3 家餐廳推薦
- **THEN** 第 1 家 SHALL 對應偏好 index 0 的料理類型、第 2 家對應 index 1、第 3 家對應 index 2

#### Scenario: 偏好料理不可得時
- **WHEN** 某偏好料理在行程地點附近找不到評價足夠的餐廳
- **THEN** SHALL 以行程地點附近評價最高的餐廳補位，並在 `notes` 欄位標註「當地無符合偏好之選項，改推薦{實際料理類型}」
