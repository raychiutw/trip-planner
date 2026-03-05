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
- **AND** 選填欄位：`url`、`blogUrl`、`details`、`checkout`、`subs`、`infoBoxes` 存在時驗證結構

#### Scenario: hotel.breakfast 結構

- **WHEN** hotel 物件包含 `breakfast`
- **THEN** `breakfast.included` SHALL 為 `true`、`false` 或 `null`
- **AND** `breakfast.note` 為選填字串

#### Scenario: timeline event 結構

- **WHEN** 驗證 timeline 中的每個 event
- **THEN** SHALL 確認存在必填欄位：`time`、`title`
- **AND** 選填欄位：`titleUrl`、`blogUrl`、`desc`、`transit`、`infoBoxes`、`locations` 存在時驗證結構

#### Scenario: transit 結構

- **WHEN** timeline event 包含 `transit`
- **THEN** SHALL 確認包含 `type`（字串）和 `min`（數字）

#### Scenario: MapLocation 物件驗證

- **WHEN** 任一 location 物件存在（timeline `locations[]` 元素、restaurant `.location`、shop `.location`、gasStation `.location`）
- **THEN** SHALL 確認包含必填欄位：`name`（非空字串）、`googleQuery`（以 `https://` 開頭的字串）、`appleQuery`（以 `https://` 開頭的字串）
- **AND** 選填欄位 `mapcode`（非空字串）、`label`（非空字串）存在時驗證型別

#### Scenario: restaurants infoBox 結構

- **WHEN** infoBox `type` 為 `restaurants`
- **THEN** SHALL 確認 `restaurants` 為陣列，每個餐廳必填：`name`、`hours`、`reservation`
- **AND** 選填欄位：`desc`、`price`、`url`、`reservationUrl`、`location`、`blogUrl`

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

### Requirement: gasStation infoBox schema 驗證

Schema 驗證 SHALL 確認 `gasStation` infoBox 結構正確。gasStation 欄位 SHALL 直接位於 infoBox 頂層（扁平結構），不使用 `station` wrapper。

#### Scenario: gasStation 必填欄位

- **WHEN** infoBox `type` 為 `gasStation`
- **THEN** SHALL 確認 infoBox 頂層包含必填欄位：`name`（字串）、`address`（字串）、`hours`（字串）、`service`（字串）、`phone`（字串）

#### Scenario: gasStation 選填欄位

- **WHEN** gasStation infoBox 包含 `location`
- **THEN** location SHALL 為有效 MapLocation 物件（含 `name`、`googleQuery`、`appleQuery`）

#### Scenario: gasStation 不含 station wrapper

- **WHEN** infoBox `type` 為 `gasStation`
- **THEN** SHALL 不包含 `station` 欄位（欄位已扁平化至頂層）
