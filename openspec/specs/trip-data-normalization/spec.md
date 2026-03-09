## ADDED Requirements

### Requirement: URL 格式統一
所有行程 JSON 中的地圖 URL 須遵循統一格式：
- Google Maps：`https://www.google.com/maps/search/<percent-encoded query>`
- Apple Maps：`https://maps.apple.com/?q=<percent-encoded 原店名含分店>`
- Naver Maps：`https://map.naver.com/v5/search/<percent-encoded 簡體中文查詢詞>`

#### Scenario: Google Maps URL 正規化
- **WHEN** 行程 JSON 中有 `googleQuery` 欄位
- **THEN** URL 格式 SHALL 為 `https://www.google.com/maps/search/<encoded>`，CJK 字元 percent-encode，空格為 `%20` 或 `+`

#### Scenario: Naver Maps URL 簡中轉換
- **WHEN** 行程 JSON 中有 `naverQuery` 欄位且查詢詞含繁體中文
- **THEN** 查詢詞 SHALL 先轉為簡體中文，再 percent-encode

### Requirement: naverQuery splitter/builder 支援
Splitter SHALL 對 location 輸出 `- naver: <url>`。Restaurant 和 shop 表格 SHALL 包含 `naver` 欄。Builder SHALL 將 `naver` 欄解析回 `naverQuery` 欄位。

#### Scenario: location naverQuery round-trip
- **WHEN** location 物件有 `naverQuery` 欄位
- **THEN** 經過 split → build 後 SHALL 保留完整的 `naverQuery` URL

#### Scenario: restaurant 表格 naverQuery
- **WHEN** restaurant location 有 `naverQuery`
- **THEN** 表格 SHALL 有 `naver` 欄，值為完整 URL

### Requirement: restaurant 表格 appleMaps 欄
Restaurant 表格 SHALL 支援 `appleMaps` 欄（與 shop 表格一致），當 Apple query 與 Google query 不同時輸出。

#### Scenario: Apple query 差異保留
- **WHEN** restaurant location 的 `appleQuery` 查詢詞與 `googleQuery` 不同
- **THEN** 表格 SHALL 有 `appleMaps` 欄，值為 Apple 專用查詢詞
- **THEN** round-trip 後 `appleQuery` SHALL 保留原始值

### Requirement: hotel.googleRating 支援
Splitter SHALL 輸出 `- rating: <value>`。Builder SHALL 讀取並設為 `hotel.googleRating`。

#### Scenario: hotel googleRating round-trip
- **WHEN** hotel 有 `googleRating: 4.2`
- **THEN** MD 輸出 `- rating: 4.2`
- **THEN** build 後 SHALL 還原為 `googleRating: 4.2`

### Requirement: breakfast.note 含 included=false
Splitter SHALL 在 `included=false` 時也輸出 note：`- breakfast: false <note>`。

#### Scenario: included false with note
- **WHEN** `breakfast.included` 為 `false` 且 `note` 為 `"自助早餐 ¥2,200"`
- **THEN** MD 輸出 `- breakfast: false 自助早餐 ¥2,200`
- **THEN** build 後 SHALL 還原為 `{ included: false, note: "自助早餐 ¥2,200" }`

### Requirement: breakfast.included null 例外
`breakfast.included` SHALL 允許 `null` 值（R0 例外），代表「未確認」。Splitter 對 null 不輸出 breakfast 行。Builder 見不到 breakfast 行時 SHALL 設為 `{ included: null }`。

#### Scenario: breakfast included null round-trip
- **WHEN** `breakfast.included` 為 `null`
- **THEN** MD 不輸出 breakfast 行
- **THEN** build 後 SHALL 還原為 `{ included: null }`

### Requirement: 通用 note 欄位
Hotel、restaurant、shop、event、parking 全部 SHALL 有 `note` 欄位。空值為 `""`。空 note 不輸出到 MD，builder 還原為 `""`。

#### Scenario: 有值 note round-trip
- **WHEN** parking 有 `note: "飯店附設收費停車場"`
- **THEN** MD 輸出 `- note: 飯店附設收費停車場`
- **THEN** build 後 SHALL 保留原值

#### Scenario: 空 note round-trip
- **WHEN** parking 有 `note: ""`
- **THEN** MD 不輸出 note 行
- **THEN** build 後 SHALL 還原為 `note: ""`

### Requirement: source 必填
所有 hotel、restaurant、shop、gasStation、event SHALL 有 `source` 欄位。Splitter 輸出 `- source: <value>`。Builder 讀取，不自動加預設值。

#### Scenario: source round-trip
- **WHEN** event 有 `source: "ai"`
- **THEN** MD 輸出 `- source: ai`
- **THEN** build 後 SHALL 還原為 `source: "ai"`

### Requirement: 正式旅館判斷
Builder SHALL 用 `checkout` 欄位存在與否判斷正式旅館，取代 `hasUrl || hasDetails`。

#### Scenario: 有 checkout 的 hotel
- **WHEN** hotel MD 有 `- checkout:` 行
- **THEN** builder SHALL 視為正式旅館，解析 infoBoxes、source 等欄位

#### Scenario: 無 checkout 的 hotel
- **WHEN** hotel MD 沒有 `- checkout:` 行
- **THEN** builder SHALL 視為簡易旅館，只設 name + breakfast

### Requirement: Emergency 格式統一
所有行程 emergency contacts SHALL 使用 `{label, phone, url}` 結構。Card SHALL 有 `color` 欄位。

#### Scenario: Emergency contacts 結構
- **WHEN** emergency card 有 contacts
- **THEN** 每個 contact SHALL 為 `{ label: string, phone: string, url: string }`

### Requirement: Flight segments 格式統一
所有 flight segments SHALL 使用 `{label, route, time}` 三欄結構。所有 flights SHALL 有 `airline` 欄位。

#### Scenario: Flight segment 結構
- **WHEN** flights 有 segments
- **THEN** 每個 segment SHALL 只有 `label`、`route`、`time` 三個欄位

### Requirement: 最後一天無 hotel
行程最後一天的 `content` SHALL 不包含 `hotel` 鍵。

#### Scenario: 最後一天
- **WHEN** 處理行程最後一天
- **THEN** `day.content` SHALL 不含 `hotel` 屬性

### Requirement: location.name 必填
所有 location 物件 SHALL 有 `name` 欄位。

#### Scenario: location 有 name
- **WHEN** location 物件存在
- **THEN** SHALL 有非空 `name` 欄位

### Requirement: Flights airline 必填
所有行程的 `flights.content` SHALL 有 `airline` 物件。

#### Scenario: 無航空公司資訊
- **WHEN** 行程沒有航空公司資訊
- **THEN** SHALL 設 `airline: { name: "", note: "" }`
