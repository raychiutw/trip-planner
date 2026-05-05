# POI 欄位規格與查詢策略

## v2.23.0 Google Maps Platform — Place Details API（11 個 tp-* skill 共用 reference）

從 v2.23.0 起，POI rating / hours / business_status / phone / address 來源統一從 Google Place Details API。**不再** WebSearch scrape Google Maps page，**不再** OSM Overpass。

**Canonical curl block**（11 個 skill 全引用此處，autoplan T15 fix）：

```bash
# Step 1: search by name + region → 取 place_id
curl -s -H "X-Goog-Api-Key: $GOOGLE_MAPS_API_KEY" \
  -H "X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location" \
  -H "Content-Type: application/json" \
  -X POST "https://places.googleapis.com/v1/places:searchText" \
  -d '{"textQuery":"沖繩美麗海水族館","regionCode":"jp","languageCode":"zh-TW","maxResultCount":1}'
# → response.places[0].id 是 place_id（"ChIJ..." 格式）

# Step 2: Place Details by place_id → 取 rating / hours / business_status / phone
curl -s -H "X-Goog-Api-Key: $GOOGLE_MAPS_API_KEY" \
  -H "X-Goog-FieldMask: id,displayName,formattedAddress,location,rating,businessStatus,regularOpeningHours.weekdayDescriptions,internationalPhoneNumber" \
  "https://places.googleapis.com/v1/places/$PLACE_ID?languageCode=zh-TW"
```

**Field 對映**：
- `rating` (1-5 scale) → pois.rating
- `businessStatus` 'OPERATIONAL' / 'CLOSED_TEMPORARILY' / 'CLOSED_PERMANENTLY' → pois.status (active/active/closed)
- `regularOpeningHours.weekdayDescriptions` → pois.hours（join '\n'）
- `internationalPhoneNumber` → pois.phone
- 404 NOT_FOUND → pois.status='missing' + status_reason='Google Maps 查無資料'

**首次失敗 401 alert**（autoplan T15 fix）：
mac mini cron 第一個 request 401 → Telegram 「[tp-cron] GOOGLE_MAPS_API_KEY rejected — 檢查 ~/.tripline-cron/.env」並 exit non-zero。實作位於 `scripts/google-poi-refresh-30d.ts`。

**Quota safety**：50/day Place Details for backfill + 50/day for 30d refresh = 100/day cap（autoplan T11 fix）。Live `/api/poi-search` 走 D1 cache（24h TTL），cache miss 才打 Places。

## POI 欄位規格

### findOrCreatePoi 支援的完整欄位

pois 表 20 個欄位（id, type, name, description, note, address, phone, email, website, hours, google_rating, category, maps, mapcode, lat, lng, country, source, created_at, updated_at），API `PUT /days/:num` 的 `findOrCreatePoi` 全部支援。
`PATCH /pois/:id`（admin 或帶 tripId 的有權限使用者）也支援所有欄位。

### 各 type 必填 / 建議欄位

> ⚠️ pois master 與 trip_pois override 的欄位不同。checkout / breakfast_* / price / reservation* / must_buy 是 **trip_pois 欄位**，PATCH /pois/:id 不接受。

**pois master（PATCH /pois/:id 可修改）：**

| type | 必填 | 建議填 |
|------|------|--------|
| hotel | name, google_rating, maps | description, address, phone, mapcode |
| restaurant | name, category, hours, google_rating, maps | description |
| shopping | name, category, hours, google_rating, maps | description |
| parking | name, description, maps | mapcode |
| attraction | name, google_rating, maps | description, hours |
| transport | name, maps | description, hours |
| activity | name, google_rating, maps, hours | description |

**trip_pois override（PATCH /trip-pois/:tpid 可修改）：**

| type | 可覆寫欄位 |
|------|-----------|
| hotel | description, note, hours, checkout, breakfast_included, breakfast_note |
| restaurant | description, note, hours, price, reservation, reservation_url |
| shopping | description, note, hours, must_buy |

pois.type 允許值：`hotel`, `restaurant`, `shopping`, `parking`, `attraction`, `transport`, `activity`, `other`（v2.1.2.0+ 納入 `activity`）

### Phase 2 POI Unification：timeline entry 的 POI master（v2.1.2.0+）

每個 timeline entry 都會對應一筆 pois master，透過 `trip_entries.poi_id` FK 關聯。PUT /days/:num 與 POST /entries 會自動 find-or-create。

- `poi_type`（body 欄位，選填）：決定這個 entry 的 POI 屬於哪一類。**預設 `attraction`**。
  - `transport`：機場、車站、港口、碼頭（`title` 含「機場 / 空港 / 港 / 碼頭 / 站 / 駅 / airport / station / port」時必傳）
  - `activity`：需預訂的體驗活動（浮潛、玉泉洞、鳳梨園、工作坊等，有 reservation 且耗時 > 1h）
  - `attraction`：一般景點（寺廟、公園、城堡、海灘、觀景台）
- 其餘欄位（`maps`, `mapcode`, `lat`, `lng`, `google_rating`, `description`）會流進 pois master，由 find-or-create 用 `UNIQUE(name, type)` 去重（同 name + type 共享同一筆 pois row）。
- PATCH /entries/:eid 可傳 `poi_id` 重新指向既有 POI master（例如統一兩個 entry 用同 POI）。

### 資料所有權

- `pois` = AI 維護的 master 資料（google_rating, maps, address 等客觀資訊）
- `trip_pois` = 使用者可覆寫（description, note, checkout 等主觀/行程相關欄位）
- COALESCE convention：trip_pois 欄位 NULL = 繼承 pois master

### API 操作端點

| 操作 | 端點 | 說明 |
|------|------|------|
| 新增 entry | `POST /api/trips/{id}/days/{dayNum}/entries` | 必填 `title`，選填 `sort_order`（省略 append 到最後） |
| 新增 POI 到 entry | `POST /api/trips/{id}/entries/{eid}/trip-pois` | 餐廳、購物統一端點 |
| 修改 trip_pois | `PATCH /api/trips/{id}/trip-pois/{tpid}` | 覆寫欄位（NULL = 繼承 master） |
| 刪除 trip_pois | `DELETE /api/trips/{id}/trip-pois/{tpid}` | 移除關聯 |
| 修改 pois master | `PATCH /api/pois/{id}` | admin 或帶 `tripId` 的有權限使用者 |
| 刪除 pois master | `DELETE /api/pois/{id}` | admin only，會一併刪除所有關聯 trip_pois |

## Google Maps 驗證（鐵律）

**Google Maps 是所有 POI 資料的 source of truth。** 新增或更新 POI 前，必須先確認 Google Maps 上存在該 POI。查不到 = 無效，不得新增或保留。完整驗證流程見 `tp-search-strategies` SKILL.md「前置步驟：Google Maps 驗證」。

## googleRating 查詢策略

**優先用 `/browse` 開 Google Maps**（WebSearch 拿不到 Google 評分 — 評分是頁面動態渲染，不在搜尋摘要中）：

1. `/browse` 開 `https://www.google.com/maps/search/{POI名稱}`
2. 從頁面文字抽取第一個 `X.X` 格式數字即為 rating
3. 同時提取 lat/lng 座標（Google Maps URL 含座標參數）
4. 如果 `/browse` 不可用，fallback：
   a. WebSearch「{名稱} {地區} Google Maps」— 確認存在 + 取座標
   b. WebSearch「{名稱} Google rating」
   c. 從 Wanderlog / TripAdvisor / Tabelog 交叉比對
5. 必須是 number 1.0–5.0，找不到時不填預設值
