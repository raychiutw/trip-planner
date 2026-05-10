# POI 欄位規格與查詢策略

## POI 欄位規格

### findOrCreatePoi 支援的完整欄位

pois 表欄位（id, type, name, description, note, address, phone, email, website, hours, rating, category, maps, mapcode, lat, lng, country, source, business_status, created_at, updated_at），API `PUT /days/:num` 的 `findOrCreatePoi` 全部支援。
`PATCH /pois/:id`（admin 或帶 tripId 的有權限使用者）也支援所有欄位。

> ⚠️ Migration 0045 (v2.19.x) 把 `pois.google_rating` 重命名為 `pois.rating`。新 code 一律用 `rating`；frontend `entry.googleRating` 是 mapDay 從 `poi.rating` 接出的 alias，DB 端不存在 `google_rating` col。

### 各 type 必填 / 建議欄位

> ⚠️ pois master 與 trip_pois override 的欄位不同。checkout / breakfast_* / price / reservation* / must_buy 是 **trip_pois 欄位**，PATCH /pois/:id 不接受。

**pois master（PATCH /pois/:id 可修改）：**

| type | 必填 | 建議填 |
|------|------|--------|
| hotel | name, rating, maps | description, address, phone, mapcode, hours |
| restaurant | name, category, hours, rating, maps | description, phone, address, business_status |
| shopping | name, category, hours, rating, maps | description, phone, address, business_status |
| parking | name, description, maps | mapcode, hours |
| attraction | name, rating, maps | description, hours, address, phone |
| transport | name, maps | description, hours |
| activity | name, rating, maps, hours | description, phone, website |

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
- 其餘欄位（`maps`, `mapcode`, `lat`, `lng`, `rating`, `description`）會流進 pois master，由 find-or-create 用 `UNIQUE(name, type)` 去重（同 name + type 共享同一筆 pois row）。
- PATCH /entries/:eid 可傳 `poi_id` 重新指向既有 POI master（例如統一兩個 entry 用同 POI）。

### 資料所有權

- `pois` = AI 維護的 master 資料（rating, maps, address 等客觀資訊）
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

## Google Maps 爬取策略（all fields）

**核心原則：優先 `/browse` 開 Google Maps 頁面**，從頁面 DOM 直接抽欄位；WebSearch 為 fallback（拿不到動態渲染的 rating、hours、business_status）。

### Step 1: 開 Google Maps 搜尋頁

```
/browse goto "https://www.google.com/maps/search/{POI 名稱}"
```

或更精確：

```
/browse goto "https://www.google.com/maps/place/{POI 名稱}/@{lat},{lng},17z"
```

### Step 2: 抽欄位

| 欄位 | 抽取方法 | 驗證 |
|------|---------|------|
| **rating** | 頁面文字第一個 `X.X` 格式（範圍 1.0–5.0） | number；找不到不填預設值 |
| **lat / lng** | URL 含 `@{lat},{lng},{zoom}z` 參數 | 4 位小數 |
| **address** | 「地址」/「Address」label 後的字串；或頁面 schema.org `streetAddress` | 含完整縣市區段 |
| **phone** | 「電話」/「Phone」label 後的字串；或 `tel:` href | E.164 國際格式（+81-...） |
| **hours** | 「營業時間」/「Hours」展開後的星期一-日字串 | join '\n' 多行 |
| **business_status** | 頁面顯示「永久歇業」/「暫停營業」 → `closed` / `closed_temp`；其他 → `active` | 三選一 |
| **website** | 「網站」/「Website」label 後的 URL | 開頭 `http://` 或 `https://` |
| **category** | 主類別 chip（「餐廳」/「景點」/「飯店」） | 對應 pois.type 推導 |

### Step 3: Fallback（`/browse` 失敗時）

1. WebSearch「{名稱} {地區} Google Maps」— 確認存在 + 取座標
2. WebSearch「{名稱} Google rating」— 取 rating（搜尋摘要可能含）
3. WebSearch「{名稱} 営業時間」/「{名稱} 電話」— 取 hours / phone
4. 從 Tabelog / TripAdvisor / 官方網站交叉比對

### Step 4: 歇業偵測

頁面顯示「永久歇業」/「Permanently closed」：
- pois.business_status = 'closed_permanently' （或 status='missing' depending on schema phase）
- pois.status_reason = 'Google Maps 顯示永久歇業'
- 既有 entry 走刪除流程（見 `modify-steps.md` §5）

頁面 404 / 查無資料：
- pois.status = 'missing' + status_reason='Google Maps 查無資料'

### Step 5: 必填驗證

新增或替換 POI 時，至少 `name + lat + lng + maps` 必填。其他欄位有則填，缺則 NULL（不填假資料）。
