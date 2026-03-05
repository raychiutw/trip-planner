## ADDED Requirements

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
- **THEN** SHALL 確認包含 `type`（字串）和 `text`（字串）

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

### Requirement: Quality 驗證層

所有 `data/trips/*.json` SHALL 通過 Quality 驗證。Quality 層檢查品質規則 R2-R9 中可機器檢查的部分。

#### Scenario: R2 航程感知餐次檢查

- **WHEN** 行程 JSON 包含 `flights` 且可解析到達/出發時間
- **THEN** 去程到達日：到達時間 < 11:30 須有午餐 + 晚餐；11:30 ≤ 到達 < 17:00 須有晚餐；≥ 17:00 晚餐可選
- **AND** 回程出發日：出發時間 < 11:30 不需午晚餐；11:30 ≤ 出發 < 17:00 須有午餐；≥ 17:00 須有午餐 + 晚餐
- **AND** 中間天 SHALL 各有午餐 + 晚餐（除非 `mealExceptions` 標記豁免）

#### Scenario: R2 無 flights 時退回傳統檢查

- **WHEN** 行程 JSON 不含 `flights` 或無法解析到達/出發時間
- **THEN** SHALL 退回每日皆須午餐 + 晚餐的傳統檢查

#### Scenario: R2 一日遊團例外

- **WHEN** 某日 timeline 標記為一日遊團體行程（event 包含 `groupTour: true`）
- **THEN** SHALL 不檢查該日午餐

#### Scenario: R3 餐廳數量檢查

- **WHEN** 任一 `infoBox type=restaurants` 存在
- **THEN** `restaurants` 陣列長度 SHALL ≥ 3

#### Scenario: R3 餐廳必填欄位

- **WHEN** 任一餐廳物件存在
- **THEN** SHALL 包含 `hours`、`reservation`（字串值非空）

#### Scenario: R3 營業時間吻合

- **WHEN** 餐廳所屬 timeline event 的 `time` 可解析
- **THEN** 餐廳 `hours` 的開始時間 SHALL ≤ event 時間（不推薦 17:00 開的店當午餐）

#### Scenario: R7 shopping shop 必填

- **WHEN** 任一 `infoBox type=shopping` 的 `shops[]` 存在
- **THEN** 每個 shop SHALL 包含 `mustBuy` 陣列且長度 ≥ 3

#### Scenario: R7 shop 不含 titleUrl

- **WHEN** 任一 shop 物件存在
- **THEN** SHALL 不包含 `titleUrl` 欄位

#### Scenario: R8 早餐欄位存在

- **WHEN** 某日包含 `hotel`
- **THEN** `hotel.breakfast` SHALL 存在且 `breakfast.included` 為 `true`、`false` 或 `null`

#### Scenario: R9 AI 亮點字數

- **WHEN** 行程 JSON 包含 `highlights.content.summary`
- **THEN** summary 字數（中英文字元含標點，不含空白）SHALL ≤ 50

#### Scenario: R9 AI 亮點不列舉景點

- **WHEN** 驗證 `highlights.content.summary`
- **THEN** summary 中 SHALL 不包含 "Day" 開頭的行程列舉（如 "Day 2 搭乘..."）

### Requirement: Claude Code Hook 即時 Gate

修改 `data/trips/*.json` 後 SHALL 自動觸發驗證，驗證失敗時停止執行。

#### Scenario: Hook 觸發

- **WHEN** Claude Code 的 Edit 或 Write tool 修改 `data/trips/*.json`
- **THEN** SHALL 自動執行 `npm test -- tests/json/`

#### Scenario: 驗證通過

- **WHEN** hook 觸發的驗證全部通過（exit code 0）
- **THEN** Claude Code SHALL 繼續正常執行

#### Scenario: 驗證失敗

- **WHEN** hook 觸發的驗證有任一失敗（exit code 非 0）
- **THEN** Claude Code SHALL 停下來，顯示驗證錯誤訊息

### Requirement: rules-json-schema.md 同步

`rules-json-schema.md` SHALL 對齊實際行程 JSON 結構，包含所有新增欄位。

#### Scenario: 新增 breakfast 欄位

- **WHEN** 讀取 `rules-json-schema.md` 的 Hotel 定義
- **THEN** SHALL 包含 `breakfast: { included: true|false|null, note: "可選" }` 和 `checkout: "11:00"（可選）`

#### Scenario: 結構對齊實際 JSON

- **WHEN** 比對 `rules-json-schema.md` 與任一行程 JSON
- **THEN** schema 定義 SHALL 與實際 JSON 結構一致（欄位名稱、巢狀層級、必填/選填）

### Requirement: meta.selfDrive schema 驗證
Schema 驗證 SHALL 確認 `meta.selfDrive` 欄位存在且值有效。

#### Scenario: selfDrive 必填
- **WHEN** 驗證任一行程 JSON
- **THEN** `meta.selfDrive` SHALL 存在

#### Scenario: selfDrive 值驗證
- **WHEN** `meta.selfDrive` 存在
- **THEN** 值 SHALL 為 `true` 或 `false`（boolean）

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

### Requirement: googleRating schema 驗證

Schema 驗證 SHALL 確認 `googleRating` 欄位在存在時為合法數字（1.0-5.0）。欄位為選填，不存在時驗證 SHALL 通過。

#### Scenario: timeline event googleRating 型別驗證

- **WHEN** timeline event 物件含有 `googleRating`
- **THEN** 值 SHALL 為數字型別（`typeof === 'number'`）
- **AND** 值 SHALL 在 1.0 至 5.0 的範圍內（含邊界）
- **AND** 不符合時 SHALL 產生 schema 驗證錯誤

#### Scenario: restaurant googleRating 型別驗證

- **WHEN** restaurant 物件含有 `googleRating`
- **THEN** 值 SHALL 為數字型別
- **AND** 值 SHALL 在 1.0 至 5.0 的範圍內（含邊界）
- **AND** 不符合時 SHALL 產生 schema 驗證錯誤

#### Scenario: shop googleRating 型別驗證

- **WHEN** shop 物件含有 `googleRating`
- **THEN** 值 SHALL 為數字型別
- **AND** 值 SHALL 在 1.0 至 5.0 的範圍內（含邊界）
- **AND** 不符合時 SHALL 產生 schema 驗證錯誤

#### Scenario: googleRating 缺失時驗證通過

- **WHEN** timeline event、restaurant 或 shop 物件不含 `googleRating`
- **THEN** schema 驗證 SHALL 通過（選填欄位不存在不報錯）

### Requirement: R10 還車加油站 quality 驗證
Quality 驗證 SHALL 確認自駕行程的還車事件包含加油站資訊。

#### Scenario: 自駕行程還車須有加油站
- **WHEN** `meta.selfDrive` 為 `true`
- **AND** 某日 timeline 有 event title 包含「還車」
- **THEN** 該 event 的 infoBoxes SHALL 包含至少一個 `type: "gasStation"`

#### Scenario: 非自駕行程不檢查
- **WHEN** `meta.selfDrive` 為 `false`
- **THEN** SHALL 跳過 R10 檢查
