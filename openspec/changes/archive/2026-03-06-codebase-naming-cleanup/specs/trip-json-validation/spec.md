## MODIFIED Requirements

### Requirement: Schema 驗證層

所有 `data/trips/*.json` SHALL 通過 Schema 驗證。Schema 層檢查欄位存在性，確保結構完整。驗證範圍涵蓋根層級欄位、每日結構、hotel 物件、timeline event、infoBox 結構。

#### Scenario: 根層級必填欄位

- **WHEN** 驗證任一行程 JSON
- **THEN** SHALL 確認存在以下必填欄位：`title`、`themeColor`、`days`（陣列）、`weather`（陣列）、`autoScrollDates`（陣列）、`highlights`、`suggestions`、`checklist`

#### Scenario: 根層級選填欄位

- **WHEN** 驗證任一行程 JSON
- **THEN** `flights`、`emergency` 欄位 SHALL 為選填（存在時驗證結構，不存在不報錯）

#### Scenario: 每日結構必填欄位

- **WHEN** 驗證 `days[]` 中的每一天
- **THEN** SHALL 確認存在：`id`、`date`、`label`、`timeline`（陣列）

#### Scenario: hotel 物件結構

- **WHEN** 某日包含 `hotel` 欄位
- **THEN** SHALL 確認存在必填欄位：`name`、`breakfast`（物件，含 `included` 欄位）
- **AND** 選填欄位：`url`、`blogUrl`、`details`、`checkout`、`infoBoxes` 存在時驗證結構
- **AND** SHALL 不包含 `subs` 欄位（已移除，停車場資料 SHALL 位於 `infoBoxes[type=parking]`）

#### Scenario: hotel.breakfast 結構

- **WHEN** hotel 物件包含 `breakfast`
- **THEN** `breakfast.included` SHALL 為 `true`、`false` 或 `null`
- **AND** `breakfast.note` 為選填字串

#### Scenario: timeline event 結構

- **WHEN** 驗證 timeline 中的每個 event
- **THEN** SHALL 確認存在必填欄位：`time`、`title`
- **AND** 選填欄位：`titleUrl`、`blogUrl`、`description`、`travel`、`infoBoxes`、`locations` 存在時驗證結構

#### Scenario: travel 結構

- **WHEN** timeline event 包含 `travel`
- **THEN** SHALL 確認包含 `type`（字串）和 `min`（數字）

#### Scenario: restaurants 餐廳描述欄位

- **WHEN** 驗證 restaurants infoBox 中的餐廳物件
- **THEN** 描述欄位 SHALL 為 `description`（非 `desc`）

#### Scenario: MapLocation 物件驗證

- **WHEN** 任一 location 物件存在（timeline `locations[]` 元素、restaurant `.location`、shop `.location`、gasStation `.location`）
- **THEN** SHALL 確認包含必填欄位：`name`（非空字串）、`googleQuery`（以 `https://` 開頭的字串）、`appleQuery`（以 `https://` 開頭的字串）
- **AND** 選填欄位 `mapcode`（非空字串）、`label`（非空字串）存在時驗證型別

#### Scenario: parking infoBox 結構

- **WHEN** infoBox `type` 為 `parking`
- **THEN** SHALL 確認包含 `title`（字串）
- **AND** 選填欄位：`price`（字串）、`note`（字串）、`location`（Location 物件）存在時驗證結構

#### Scenario: restaurants infoBox 結構

- **WHEN** infoBox `type` 為 `restaurants`
- **THEN** SHALL 確認 `restaurants` 為陣列，每個餐廳必填：`name`、`hours`、`reservation`
- **AND** 選填欄位：`description`、`price`、`url`、`reservationUrl`、`location`、`blogUrl`

#### Scenario: shopping infoBox 結構

- **WHEN** infoBox `type` 為 `shopping`
- **THEN** SHALL 確認 `shops` 為陣列，每個 shop 必填：`category`、`name`、`hours`、`mustBuy`（陣列）
- **AND** 選填欄位：`blogUrl`、`location`

#### Scenario: flights 結構（若存在）

- **WHEN** 行程 JSON 包含 `flights`
- **THEN** SHALL 確認包含 `title` 和 `content`（或直接包含 `segments`）
- **AND** 每個 segment SHALL 包含 `label`、`route`，以及 `time`（合併字串）或 `depart` + `arrive`（結構化）

#### Scenario: highlights 結構

- **WHEN** 驗證 `highlights`
- **THEN** SHALL 確認包含 `title` 和 `content`（含 `summary` 字串和 `tags` 陣列）

#### Scenario: 涵蓋所有行程檔

- **WHEN** 執行 Schema 驗證測試
- **THEN** SHALL 動態掃描 `data/trips/` 目錄中所有 `.json` 檔案並逐一驗證
