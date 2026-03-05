## MODIFIED Requirements

### Requirement: R1 料理偏好詢問
`/render-trip` 為某行程產生餐廳推薦前，SHALL 先讀取 JSON `meta.foodPreferences`；若欄位存在且非空則直接採用，否則詢問使用者並將回答寫回 JSON。後續推薦的第 1 家餐廳 SHALL 對應偏好 1、第 2 家對應偏好 2、第 3 家對應偏好 3。

#### Scenario: R1/R3 category 嚴格對齊
- **WHEN** restaurants infoBox 中的餐廳按順序排列
- **THEN** 每家餐廳的 `category` SHALL 包含對應 `meta.foodPreferences` 的關鍵字（index 0 對齊偏好 0、index 1 對齊偏好 1、index 2 對齊偏好 2）
- **AND** 不符合時 SHALL 以紅燈（fail）標示，不再以 warn 標示

#### Scenario: JSON 已有偏好
- **WHEN** 行程 JSON 的 `meta.foodPreferences` 為非空陣列
- **THEN** SHALL 直接採用，不詢問使用者

#### Scenario: JSON 無偏好
- **WHEN** 行程 JSON 的 `meta.foodPreferences` 不存在或為空陣列
- **THEN** SHALL 詢問「有沒有特別想吃的料理類型？最多三類，依優先排序」，取得回答後 SHALL 寫回 `meta.foodPreferences`

#### Scenario: 餐廳順序對齊偏好
- **WHEN** 某 restaurants infoBox 包含多家餐廳推薦
- **THEN** 第 1 家 SHALL 對應偏好 index 0、第 2 家對應 index 1、第 3 家對應 index 2

#### Scenario: 偏好料理不可得時
- **WHEN** 某偏好料理在行程地點附近找不到評價足夠的餐廳
- **THEN** SHALL 以行程地點附近評價最高的餐廳補位，並在 `notes` 欄位標註「當地無符合偏好之選項，改推薦{實際料理類型}」

### Requirement: R4 景點品質
景點 timeline entry 的 `titleUrl` SHALL 放官網連結（找不到官網則不放）。景點 timeline entry SHALL 包含 `blogUrl` 欄位放繁中推薦網誌（查不到時為空字串 `""`）。景點 `infoBoxes` SHALL 包含營業時間資訊。R4 blogUrl 採 strict 級（紅燈）。

#### Scenario: 景點 blogUrl 必須存在
- **WHEN** timeline event 為實體地點（非 travel、非「餐廳未定」）
- **THEN** SHALL 包含 `blogUrl` 欄位（字串，允許空字串 `""`）
- **AND** 缺失時 SHALL 以紅燈（fail）標示

#### Scenario: 景點 titleUrl 為官網
- **WHEN** 景點有官方網站
- **THEN** `titleUrl` SHALL 為該景點官方網站 URL

#### Scenario: 景點 blogUrl 為繁中網誌
- **WHEN** 景點 timeline entry 產生或補齊
- **THEN** SHALL 搜尋 Google「{景點名} {地區} 推薦」，將第一篇繁體中文文章 URL 填入 `blogUrl`

#### Scenario: 景點含營業時間
- **WHEN** 景點有營業時間限制
- **THEN** `infoBoxes` 中 SHALL 包含營業時間項目，且 SHALL 確認與行程安排的到訪時間吻合

#### Scenario: 景點 blogUrl 查無結果
- **WHEN** Google 搜尋「{景點名} {地區} 推薦」無適合的繁體中文文章
- **THEN** `blogUrl` SHALL 為空字串 `""`

### Requirement: R11 地圖導航

所有景點、餐廳、加油站 SHALL 包含 location 欄位，確保使用者可直接開啟地圖導航。location 物件 SHALL 遵循 MapLocation 統一型別。R11 採 strict 級（紅燈），缺失時中斷測試。

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
- **THEN** SHOULD 包含 `location` 物件，但不強制

#### Scenario: travel event 略過 R11
- **WHEN** timeline event 含 `travel` 物件（交通移動資訊）
- **THEN** SHALL 略過 R11 檢查

#### Scenario: 餐廳未定 event 略過 R11
- **WHEN** timeline event title 包含「餐廳未定」
- **THEN** SHALL 略過 R11 檢查

#### Scenario: location 缺失時 fail
- **WHEN** 實體地點 event 不含 `locations`
- **THEN** SHALL 以紅燈（fail）標示

### Requirement: R12 Google 評分

所有 POI（實體地點類 timeline event、餐廳、商店）SHALL 含 `googleRating` 欄位（數字，1.0-5.0）。R12 採 strict 級（紅燈），缺失時中斷測試。

#### Scenario: 景點含 googleRating
- **WHEN** timeline event 為實體地點
- **THEN** SHALL 含 `googleRating`（數字，1.0-5.0）

#### Scenario: 餐廳含 googleRating
- **WHEN** restaurant 物件存在
- **THEN** SHALL 含 `googleRating`（數字，1.0-5.0）

#### Scenario: 商店含 googleRating
- **WHEN** shop 物件存在
- **THEN** SHALL 含 `googleRating`（數字，1.0-5.0）

#### Scenario: travel event 略過 R12
- **WHEN** timeline event 含 `travel` 物件（交通移動資訊）
- **THEN** SHALL 略過 R12 檢查

#### Scenario: 餐廳未定 event 略過 R12
- **WHEN** timeline event title 包含「餐廳未定」
- **THEN** SHALL 略過 R12 檢查

#### Scenario: googleRating 缺失時 fail
- **WHEN** 實體地點 event、餐廳或商店不含 `googleRating`
- **THEN** SHALL 以紅燈（fail）標示
