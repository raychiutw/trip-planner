## ADDED Requirements

### Requirement: foodPreferences 欄位定義
行程 JSON `meta` 物件 SHALL 支援選填的 `foodPreferences` 欄位。值為字串陣列，最多 3 個元素，依使用者偏好優先排序。

#### Scenario: 欄位存在時
- **WHEN** 行程 JSON `meta` 包含 `foodPreferences`
- **THEN** 值 SHALL 為字串陣列，長度 1~3，元素為料理類型名稱（如「拉麵」「燒肉」「當地特色」）

#### Scenario: 欄位缺少時
- **WHEN** 行程 JSON `meta` 不包含 `foodPreferences`
- **THEN** SHALL 視為合法（向下相容），不影響既有行程載入

#### Scenario: 偏好順序意義
- **WHEN** `foodPreferences` 有多個元素
- **THEN** 索引 0 為最高優先偏好，索引 1 為次優先，索引 2 為第三優先
