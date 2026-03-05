## ADDED Requirements

### Requirement: MapLocation 統一型別

所有 location 物件（timeline event `locations[]`、restaurant `.location`、shop `.location`、gasStation `.location`）SHALL 遵循統一的 MapLocation 型別定義。

欄位定義：
- `name`（必填，字串）：地點名稱，用於顯示與 fallback 查詢
- `googleQuery`（必填，字串）：Google Maps URL，格式為 `https://maps.google.com/?q=...` 或 `https://www.google.com/maps/...`
- `appleQuery`（必填，字串）：Apple Maps URL，格式為 `https://maps.apple.com/?q=...`
- `mapcode`（選填，字串）：日本車機導航碼
- `label`（選填，字串）：多地點時的分類標籤

#### Scenario: 必填欄位驗證

- **WHEN** 任一 location 物件存在
- **THEN** SHALL 包含 `name`（非空字串）、`googleQuery`（以 `https://` 開頭的字串）、`appleQuery`（以 `https://` 開頭的字串）

#### Scenario: 選填欄位型別驗證

- **WHEN** location 物件包含 `mapcode`
- **THEN** `mapcode` SHALL 為非空字串
- **AND** 若包含 `label`，`label` SHALL 為非空字串

#### Scenario: timeline event 使用陣列容器

- **WHEN** timeline event 包含位置資訊
- **THEN** SHALL 使用 `locations` 欄位（MapLocation 陣列），每個元素遵循 MapLocation 型別

#### Scenario: restaurant/shop/gasStation 使用單一物件容器

- **WHEN** restaurant、shop 或 gasStation 包含位置資訊
- **THEN** SHALL 使用 `location` 欄位（單一 MapLocation 物件）

#### Scenario: label 欄位可用於所有容器

- **WHEN** 同一容器需區分多個位置（如 timeline 多地點、shopping infoBox 多分店）
- **THEN** 各 location 物件 SHALL 可使用 `label` 欄位標註
