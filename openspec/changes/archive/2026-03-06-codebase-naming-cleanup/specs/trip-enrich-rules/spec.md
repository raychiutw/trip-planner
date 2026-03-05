## MODIFIED Requirements

### Requirement: R11 地圖導航

所有景點、餐廳、加油站 SHALL 包含 location 欄位，確保使用者可直接開啟地圖導航。location 物件 SHALL 遵循 MapLocation 統一型別。R11 採 warn 級（黃燈），不強制中斷測試。

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

#### Scenario: location 缺失時 warn
- **WHEN** 實體地點 event 不含 `location`
- **THEN** tp-check SHALL 以黃燈（warn）標示，不以紅燈（fail）標示

### Requirement: R12 Google 評分

實體地點類 timeline event 與所有餐廳 SHOULD 含 `googleRating` 欄位（數字，1.0-5.0）。R12 採 warn 級（黃燈），不強制中斷測試。

#### Scenario: 景點含 googleRating
- **WHEN** timeline event 為實體地點
- **THEN** SHOULD 含 `googleRating`（數字，1.0-5.0）

#### Scenario: 餐廳含 googleRating
- **WHEN** restaurant 物件存在
- **THEN** SHOULD 含 `googleRating`（數字，1.0-5.0）

#### Scenario: travel event 略過 R12
- **WHEN** timeline event 含 `travel` 物件（交通移動資訊）
- **THEN** SHALL 略過 R12 檢查

#### Scenario: 餐廳未定 event 略過 R12
- **WHEN** timeline event title 包含「餐廳未定」
- **THEN** SHALL 略過 R12 檢查

#### Scenario: googleRating 缺失時 warn
- **WHEN** 實體地點 event 或餐廳不含 `googleRating`
- **THEN** tp-check SHALL 以黃燈（warn）標示

#### Scenario: shop 的 googleRating 不強制
- **WHEN** shop 物件不含 `googleRating`
- **THEN** SHALL 不發出 R12 警告（shop 評分為選填）
