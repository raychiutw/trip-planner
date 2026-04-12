# POI 欄位規格與查詢策略

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

**trip_pois override（PATCH /trip-pois/:tpid 可修改）：**

| type | 可覆寫欄位 |
|------|-----------|
| hotel | description, note, hours, checkout, breakfast_included, breakfast_note |
| restaurant | description, note, hours, price, reservation, reservation_url |
| shopping | description, note, hours, must_buy |

pois.type 允許值：`hotel`, `restaurant`, `shopping`, `parking`, `attraction`, `transport`, `other`

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
