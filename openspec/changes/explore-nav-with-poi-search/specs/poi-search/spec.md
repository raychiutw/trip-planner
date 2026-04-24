## ADDED Requirements

### Requirement: `GET /api/poi-search` 代理 OSM Nominatim 並統一格式
系統 SHALL 提供 `GET /api/poi-search?q=<query>&category=<type>&bias=<region>` endpoint：
- `q`: 必填，搜尋 query
- `category`: 可選 one of {sight, food, hotel, shopping, all}；default `all`
- `bias`: 可選 region name 作為 geocoding 偏好

後端呼叫 Nominatim (`https://nominatim.openstreetmap.org/search`) 並將回傳轉為 trip-planner POI schema：`{id, name, address, coords: {lat, lng}, category, source: 'osm'}`。

#### Scenario: 搜尋「沖繩美麗海水族館」
- **WHEN** `GET /api/poi-search?q=沖繩美麗海水族館`
- **THEN** 回傳 200 with POI list
- **AND** 每筆 POI 含 id（placeId from OSM）+ name + address + coords

#### Scenario: 搜尋無結果
- **WHEN** query 無 match（例：`q=askldjfalksdjf`）
- **THEN** 回傳 200 with 空 array `{results: []}`
- **AND** 不 throw error

#### Scenario: Nominatim 掛掉
- **WHEN** Nominatim 回 5xx 或 timeout
- **THEN** 回傳 503 `AppError('SYS_UPSTREAM')` with retry-after header
- **AND** 前端顯示「搜尋暫時無法使用，請稍候再試」

### Requirement: API cache 熱門 query 1 小時
API SHALL 使用 Cloudflare Workers `caches.default` 以 `q + category + bias` 為 key，TTL 3600 秒。

#### Scenario: 相同 query 重複搜尋
- **WHEN** 使用者 1 分鐘內同樣 query 再搜尋
- **THEN** 第 2 次呼叫 hit cache 不 call Nominatim
- **AND** response header `X-Cache: HIT`

#### Scenario: Cache expired
- **WHEN** 3600 秒後相同 query
- **THEN** cache miss + 呼叫 Nominatim + 更新 cache
- **AND** response header `X-Cache: MISS`

### Requirement: Nominatim 請求含正確 User-Agent
API 呼叫 Nominatim SHALL 帶 User-Agent header 值為 `trip-planner/<version> (<contact-email>)`，遵守 Nominatim usage policy。

#### Scenario: 呼叫 Nominatim
- **WHEN** API 向 Nominatim fetch
- **THEN** request header `User-Agent: trip-planner/2.2.0.0 (lean.lean@gmail.com)`
- **AND** `Accept-Language: zh-TW,zh,en`（讓中文結果優先）

### Requirement: Category 映射 OSM tags
Category 值 SHALL 對應 Nominatim 的 `amenity` / `tourism` / `shop` / `accommodation` tags：
- `sight` → `tourism=attraction|museum|viewpoint|aquarium`
- `food` → `amenity=restaurant|cafe|fast_food`
- `hotel` → `accommodation=*` or `tourism=hotel`
- `shopping` → `shop=*`
- `all` → 無 tag filter

#### Scenario: 搜尋餐廳 category
- **WHEN** `GET /api/poi-search?q=壽司&category=food`
- **THEN** Nominatim 請求加 `amenity=restaurant,cafe,fast_food` filter
- **AND** 回傳結果只含符合 amenity tag 的 POI
