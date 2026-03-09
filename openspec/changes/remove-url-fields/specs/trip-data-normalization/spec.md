## MODIFIED Requirements

### Requirement: 空 blogUrl 保留
**此需求已廢止** — blogUrl 欄位已全面移除，不再需要 round-trip 保留邏輯。

#### Scenario: blogUrl 不存在
- **WHEN** MD 檔案中無 `blog` 欄位
- **THEN** builder SHALL 不產出任何 blogUrl 相關欄位

### Requirement: 正式旅館判斷
Builder SHALL 用 `checkout` 欄位存在與否判斷正式旅館。不再依賴 `url` 欄位。

#### Scenario: 有 checkout 的 hotel
- **WHEN** hotel MD 有 `- checkout:` 行
- **THEN** builder SHALL 視為正式旅館，解析 infoBoxes、source 等欄位

#### Scenario: 無 checkout 的 hotel
- **WHEN** hotel MD 沒有 `- checkout:` 行
- **THEN** builder SHALL 視為簡易旅館，只設 name + breakfast

## REMOVED Requirements

### Requirement: hotel.url 欄位
**Reason**: url 欄位（飯店訂房/參考連結）已全面移除，維護成本高、使用率低
**Migration**: 移除 trip-build.js 中 `hotel.url` 解析、app.js 中飯店名稱超連結渲染

### Requirement: restaurant.url 欄位
**Reason**: url 欄位（餐廳官網）已全面移除。reservationUrl（訂位連結）保留不動
**Migration**: 移除 trip-build.js 中 restaurant `url` 產出、app.js 中餐廳 url 渲染

### Requirement: titleUrl 欄位
**Reason**: titleUrl（景點官網，MD 中 `- web:`）已全面移除
**Migration**: 移除 trip-build.js 中 `ev.titleUrl` 解析、app.js 中景點標題超連結包裝

### Requirement: blogUrl 欄位
**Reason**: blogUrl（繁中網誌推薦）已全面移除，為三類 URL 中維護成本最高者
**Migration**: 移除 trip-build.js 解析、app.js renderBlogLink()、品質規則 R4/R5/R6 相關內容
