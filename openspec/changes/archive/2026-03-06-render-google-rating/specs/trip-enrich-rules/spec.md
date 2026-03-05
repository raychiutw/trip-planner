## MODIFIED Requirements

### Requirement: R12 Google 評分

所有 POI（實體地點類 timeline event、餐廳、商店）SHALL 含 `googleRating` 欄位（數字，1.0-5.0）。R12 採 strict 級（紅燈），缺失時中斷測試。頁面渲染 SHALL 在 POI 名稱旁顯示 `★ {rating}` 格式的評分。

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
- **THEN** tp-check SHALL 以紅燈（fail）標示

#### Scenario: 景點渲染 rating
- **WHEN** renderTimelineEvent 渲染含 googleRating 的景點
- **THEN** SHALL 在標題旁顯示 `★ {rating}`（一位小數）

#### Scenario: 餐廳渲染 rating
- **WHEN** renderRestaurant 渲染含 googleRating 的餐廳
- **THEN** SHALL 在名稱行顯示 `★ {rating}`（一位小數）

#### Scenario: 商店渲染 rating
- **WHEN** renderShop 渲染含 googleRating 的商店
- **THEN** SHALL 在名稱行顯示 `★ {rating}`（一位小數）

#### Scenario: 無 rating 時不顯示
- **WHEN** POI 的 googleRating 不存在或非數字
- **THEN** SHALL 不顯示任何評分標示
