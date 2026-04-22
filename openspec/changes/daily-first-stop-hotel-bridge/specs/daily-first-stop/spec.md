## ADDED Requirements

### Requirement: 每日首 timeline entry 規則（R19）

行程每日 `day.content.timeline` 的第一個 event SHALL 遵循下列規則，定義「今天從哪裡開始」。

- **Day 1（`days[0]`）**：首 entry SHALL 為抵達點（機場 / 車站 / 碼頭），`title` 含抵達關鍵字（如「抵達」「到達」「Arrive」），`location` 指向交通節點 POI。
- **Day N（N ≥ 2）**：首 entry SHALL 為 Day N-1 的 `day.hotel` POI 的 check-out entry。其 `location` / POI 關聯 SHALL 指向與 Day N-1 `day.hotel` 相同的 POI。`title` SHALL 含 check-out 語意（如「退房」「Check-out」）。
- **最後一天**：首 entry 規則同 Day N（=前日飯店 check-out）；尾端 SHALL NOT 設 `day.hotel`（沿用既有規則，見 `trip-quality-rules-source` R0 Hotel 結構）。

Day N 首 entry 的 `travel` 物件描述「從 Day N-1 飯店出發至次一站」的交通方式；若首 entry 與次一站地點相同（如飯店內早餐緊接 check-out），`travel` SHALL 為 `null`。

#### Scenario: Day 1 首 entry 為抵達點

- **WHEN** 產生或驗證 `days[0].content.timeline`
- **THEN** `timeline[0].title` SHALL 含抵達關鍵字
- **AND** `timeline[0].location` SHALL 指向交通節點 POI（機場 / 車站 / 碼頭）
- **AND** `timeline[0]` SHALL NOT 指向任何 hotel POI

#### Scenario: Day 2 首 entry 為 Day 1 住宿飯店 check-out

- **WHEN** `days[0].hotel` 存在且產生或驗證 `days[1].content.timeline`
- **THEN** `days[1].timeline[0].location` SHALL 指向 `days[0].hotel` 的同一個 POI
- **AND** `days[1].timeline[0].title` SHALL 含 check-out 語意

#### Scenario: 最後一天首 entry 為前日飯店 check-out、尾端不設 hotel

- **WHEN** 產生或驗證最後一天（`days[days.length - 1]`）
- **THEN** `timeline[0].location` SHALL 指向 `days[length - 2].hotel` 的同一個 POI
- **AND** 最後一天 SHALL NOT 包含 `hotel` 物件

#### Scenario: 換宿（Day N-1 hotel ≠ Day N hotel）

- **WHEN** Day N-1 `day.hotel.poi_id` 與 Day N `day.hotel.poi_id` 不同
- **THEN** `days[N].timeline[0].location` SHALL 仍指向 Day N-1 的 hotel POI（昨晚睡的地方）
- **AND** Day N 末端仍保留 Day N 的 check-in timeline entry + `day.hotel` 物件

#### Scenario: 連住（Day N-1 hotel === Day N hotel）

- **WHEN** Day N-1 `day.hotel.poi_id` 等於 Day N `day.hotel.poi_id`
- **THEN** `days[N].timeline[0].location` SHALL 仍指向該 hotel POI
- **AND** 產生的首 entry 仍獨立存在、不省略（規則一致性優先）

#### Scenario: 首 entry travel 語意

- **WHEN** Day N（N ≥ 2）的 `timeline[0]` 與 `timeline[1]` 位於不同地點
- **THEN** `timeline[0].travel` SHALL 為物件，`desc` 描述從飯店出發至下一站、`type` 為交通類型
- **WHEN** `timeline[0]` 與 `timeline[1]` 位於同一地點（如飯店內早餐接 check-out）
- **THEN** `timeline[0].travel` SHALL 為 `null`

### Requirement: `day.hotel` 物件仍為當晚住宿權威來源

R19 新增 timeline 首 entry 為「前日飯店引用」，但 `day.hotel` 物件語意不變：`day.hotel` SHALL 代表「當晚入住」的飯店，包含 `breakfast` / `checkout` / `infoBoxes` 等既有欄位。Day N timeline 首 entry 是對 Day N-1 `day.hotel` 的引用，**不複製**其 `infoBoxes`（購物 / 停車場 infoBox 只掛 `day.hotel`）。

#### Scenario: 早餐資訊仍掛於 `day.hotel.breakfast`、並 inject 進 check-out entry description

- **WHEN** 使用者在飯店吃早餐（`Day N-1.hotel.breakfast.included === true`）
- **THEN** 早餐資料（note / included）SHALL 存於 Day N-1 `day.hotel.breakfast` 作為 source of truth
- **AND** Day N timeline 首 entry SHALL NOT 產出獨立早餐 event
- **AND** Day N timeline 首 entry 的 `description` SHALL 開頭 inject `"🍳 早餐：{breakfast.note || '飯店自助'}"` 讓使用者從 timeline 看到早餐資訊（Hotel card 已移除後的 UI 補償）
- **AND** Day N timeline 首 entry SHALL NOT 複製 `infoBoxes`
- **WHEN** `breakfast.included === false` 或 `null`
- **THEN** check-out entry description SHALL NOT inject 早餐行，僅描述退房

#### Scenario: 首 entry 不複製 hotel infoBoxes

- **WHEN** Day N-1 `day.hotel.infoBoxes` 包含 parking / shopping infoBox
- **THEN** Day N timeline 首 entry SHALL NOT 包含這些 infoBoxes（仍掛 Day N-1 `day.hotel`）

### Requirement: UI 不再獨立渲染住宿摘要與每日交通統計

React UI SHALL NOT 在 `DaySection` 中獨立渲染 Hotel card 或 DayDrivingStatsCard；住宿相關資訊 SHALL 僅透過 `Timeline` 的首 entry 呈現；每日交通資訊 SHALL 透過 `Timeline` 內各 entry 的 `travel` 資訊呈現。

#### Scenario: DaySection 不含 Hotel card

- **WHEN** 渲染任一 `DaySection`
- **THEN** DOM SHALL NOT 包含 `<Hotel>` 元件對應的區塊
- **AND** DOM SHALL NOT 包含「住宿」「Check-in」標題的獨立 card（Timeline 內的 entry 不受此限）

#### Scenario: DaySection 不含每日交通統計 card

- **WHEN** 渲染任一 `DaySection`
- **THEN** DOM SHALL NOT 包含 `<DayDrivingStatsCard>` 元件對應的區塊
- **AND** 頁面 SHALL NOT 包含「當日交通」獨立卡片
