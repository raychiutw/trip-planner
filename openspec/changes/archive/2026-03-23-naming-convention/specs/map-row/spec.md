## ADDED Requirements

### Requirement: mapRow 統一轉換函式
系統 SHALL 提供 `js/map-row.js` 匯出 `mapRow(row)` 和 `mapRows(rows)` 函式，集中管理所有 DB snake_case → JS camelCase 的欄位 rename 和 JSON string parse。

#### Scenario: snake_case → camelCase rename
- **WHEN** 傳入 `{ day_of_week: '三', self_drive: 1, must_buy: 'A, B' }`
- **THEN** 回傳 `{ dayOfWeek: '三', selfDrive: 1, mustBuy: 'A, B' }`

#### Scenario: JSON string parse
- **WHEN** 傳入 `{ weather_json: '{"label":"那霸"}', breakfast: '{"included":true}' }`
- **THEN** 回傳 `{ weather: {label:"那霸"}, breakfast: {included:true} }`（_json 後綴移除）

#### Scenario: 已是 object 的 JSON 欄位不重複 parse
- **WHEN** 傳入 `{ footer_json: { title: 'abc' } }`
- **THEN** 回傳 `{ footer: { title: 'abc' } }`

#### Scenario: mapRows 批次轉換
- **WHEN** 傳入 `[{ day_of_week: '三' }, { day_of_week: '四' }]`
- **THEN** 回傳 `[{ dayOfWeek: '三' }, { dayOfWeek: '四' }]`

### Requirement: mapApiDay 和 mapApiMeta 使用 mapRow
`app.js` 中的 `mapApiDay` 和 `mapApiMeta` SHALL 呼叫 `mapRow` 做基礎轉換，不再散寫 `if (x) y = x` rename。

#### Scenario: mapApiDay 使用 mapRow
- **WHEN** mapApiDay 收到 API response
- **THEN** 先 mapRow 轉換基礎欄位，再處理 infoBoxes 等結構性組裝

### Requirement: API 統一回傳 tripId
`/api/trips` 列表和 `/api/trips/:id` 詳情 SHALL 回傳 `tripId` 欄位（非 `id`）。

#### Scenario: trips 列表
- **WHEN** GET /api/trips
- **THEN** 每筆回傳 `{ tripId: "okinawa-...", name: "...", ... }`

#### Scenario: trip 詳情
- **WHEN** GET /api/trips/:id
- **THEN** 回傳含 `tripId` 欄位
