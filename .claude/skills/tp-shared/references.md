# tp-* Skill 共用參考

所有 tp-* skill 共用的定義和規範。各 skill 引用本文件，不重複定義。

## API 設定

- **Base URL**: `https://trip-planner-dby.pages.dev`
- **認證**: Service Token headers（寫入操作必填）
  - `CF-Access-Client-Id`: `$CF_ACCESS_CLIENT_ID`
  - `CF-Access-Client-Secret`: `$CF_ACCESS_CLIENT_SECRET`

## curl 模板（Windows encoding）

> ⚠️ Windows encoding 注意：curl -d 中的中文在 Windows shell 會變亂碼，一律用 node writeFileSync + --data @file

```bash
node -e "require('fs').writeFileSync('/tmp/{filename}.json', JSON.stringify({...}), 'utf8')"
curl -s -X {METHOD} \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
  -H "Content-Type: application/json" \
  -H "Origin: https://trip-planner-dby.pages.dev" \
  --data @/tmp/{filename}.json \
  "https://trip-planner-dby.pages.dev/api/{endpoint}"
```

## POI 欄位規格

### findOrCreatePoi 支援的完整欄位

pois 表 20 個欄位（id, type, name, description, note, address, phone, email, website, hours, google_rating, category, maps, mapcode, lat, lng, country, source, created_at, updated_at），API `PUT /days/:num` 的 `findOrCreatePoi` 全部支援。
`PATCH /pois/:id`（admin 端點）也支援所有欄位。

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
| 新增 POI 到 entry | `POST /api/trips/{id}/entries/{eid}/trip-pois` | 餐廳、購物統一端點 |
| 修改 trip_pois | `PATCH /api/trips/{id}/trip-pois/{tpid}` | 覆寫欄位（NULL = 繼承 master） |
| 刪除 trip_pois | `DELETE /api/trips/{id}/trip-pois/{tpid}` | 移除關聯 |
| 修改 pois master | `PATCH /api/pois/{id}` | admin 端點 |

## googleRating 查詢策略

**優先用 `/browse` 開 Google Maps**（WebSearch 拿不到 Google 評分 — 評分是頁面動態渲染，不在搜尋摘要中）：

1. `/browse` 開 `https://www.google.com/maps/search/{POI名稱}`
2. 從頁面文字抽取第一個 `X.X` 格式數字即為 rating
3. 如果 `/browse` 不可用，fallback：
   a. WebSearch「{名稱} Google Maps 評分」
   b. WebSearch「{名稱} Google rating」
   c. 從 Wanderlog / TripAdvisor / Tabelog 交叉比對
4. 必須是 number 1.0–5.0，找不到時不填預設值

## Markdown 支援欄位

前端會渲染 markdown 的欄位（可用粗體、列表、連結）：

| 欄位 | 支援 | 說明 |
|------|:---:|------|
| `entry.description` | ✅ | 景點描述 |
| `entry.note` | ✅ | 備註 |
| `restaurant.description` | ✅ | 餐廳描述 |
| `entry.title` | ❌ | 純文字 |
| `restaurant.name` | ❌ | 純文字 |
| `hotel.name` | ❌ | 純文字 |

## travel 欄位語意（鐵律）

> ⚠️ **travel = 從此地「出發」去下一站的交通方式**，不是「到達此地」。

前端渲染：travel 資訊顯示在該 entry 下方、下一個 entry 上方，代表「離開此景點的交通」。

| entry | travel 意義 |
|-------|-----------|
| 板橋出發 | `{type: "car", desc: "國道五號", min: 60}` = 從板橋開車 60 分到下一站 |
| 幾米廣場 | `null` = 不需移動（下一站在附近） |
| 午餐 | `{type: "car", desc: "宜蘭→冬山", min: 25}` = 午餐後開車 25 分到梅花湖 |
| 返回板橋 | `null` = 最後一站，無後續移動 |

> ⚠️ **PATCH /entries/:eid** 用 flat fields：`travel_type`, `travel_desc`, `travel_min`。
> **PUT /days/:num** 用巢狀物件：`travel: {type, desc, min}`。兩者語意相同但格式不同。

**規則：**
- 第一個 entry 通常有 travel（從出發地到第一個景點）
- 最後一個 entry 的 travel 為 null（已到終點）
- 同地點連續 entry（如農場內的早餐→體驗→退房）travel 為 null
- 插入/移除/移動 entry 時，**必須重算相鄰 entry 的 travel**

## Doc 結構規格（鐵律）

`PUT /api/trips/{tripId}/docs/{type}` 的 Body 為 `{ title, entries: [{section, title, content}] }`。

API 回傳 `{ doc_type, title, updated_at, entries: [{id, sort_order, section, title, content}] }`。

前端統一用 `DocCard` 渲染所有 doc type。DocCard 按 `section` 分組顯示，每個 entry 渲染 `title` + `content`（content 支援 markdown）。

> ⚠️ **entries 結構必須讓 DocCard 能正確渲染**：

| 欄位 | 用途 | 範例 |
|------|------|------|
| `section` | 群組標題（同 section 的 entries 歸為一組） | `"證件"`, `"緊急電話"`, `""` |
| `title` | entry 主標題（粗體顯示） | `"護照"`, `"CI-123 去程"`, `"110 報案"` |
| `content` | 詳細內容（支援 markdown，含連結 `[text](url)`） | `"TPE → OKA\n08:30-11:00"`, `"[110](tel:110)"` |

**各 doc type 建議 entries 結構：**

| doc type | section 用法 | entry 範例 |
|----------|-------------|-----------|
| **flights** | `""` (無分組) | `{title: "去程 CI-123", content: "TPE→OKA\n08:30-11:00"}` |
| **checklist** | 分類名稱 | `{section: "證件", title: "護照", content: ""}` |
| **backup** | 備案主題 | `{section: "雨天備案", title: "室內景點A", content: "描述"}` |
| **suggestions** | 優先級 | `{section: "推薦必去", title: "景點名", content: "原因"}` |
| **emergency** | 分類 | `{section: "緊急電話", title: "110 報案", content: "[110](tel:110)"}` |

**向後相容：** PUT 仍接受舊格式 `{ content: JSON字串 }`，API 自動轉為單一 entry 存入。但新建行程應一律用新格式。

### Doc 連動規則（鐵律）

> ⚠️ **每次異動 trip 相關資料（trip_days / trip_entries / trip_pois），必須重新檢視該行程所有 doc type 並更新不一致的內容。**

這不是「若影響到就更新」的條件式判斷，而是**強制連動**：行程資料變了，doc 必須跟著校準。

| doc type | 連動觸發條件 | 典型需更新場景 |
|----------|-------------|---------------|
| **checklist** | entry/POI 新增或刪除 | 新景點需帶的物品、新餐廳訂位提醒 |
| **backup** | entry 異動 | 雨天備案需覆蓋新行程的時段和地區 |
| **suggestions** | entry/POI 異動 | 推薦清單應反映尚未排入的景點 |
| **flights** | trip meta 或首末日異動 | 航班資訊變更（較少觸發） |
| **emergency** | trip meta 異動或新增城市 | 新地區的緊急電話/大使館 |

**執行方式：**
1. 完成 trip 資料修改後，`GET /api/trips/{tripId}/docs/{type}` 讀取現有 5 種 doc
2. 比對修改內容，判斷哪些 doc 需要更新
3. 對需更新的 doc 執行 `PUT /api/trips/{tripId}/docs/{type}`
4. 若無任何 doc 需更新，跳過即可（但必須經過檢視步驟）

## 行程修改共用步驟

tp-edit、tp-request、tp-rebuild 修改行程資料時的共用流程：

### 1. POI 必填欄位（新增或替換時）

| 欄位 | 規則 | 說明 |
|------|------|------|
| `source` | R13 | 使用者明確指定名稱 → `"user"`；模糊描述 → `"ai"` |
| `note` | R15 | 有備註填內容，無備註填空字串 `""` |
| `location.googleQuery` 或 `maps` | R11 | PATCH /entries 用 `location`（JSON 字串 `{"name":"...", "googleQuery":"..."}`）；PUT /days 用 `maps`（純搜尋文字） |
| `googleRating` | R12 | 1.0-5.0，`source: "ai"` 必填，`source: "user"` 盡量填。查詢策略見上方「googleRating 查詢策略」 |

POI 各 type 必填/建議欄位見上方「POI 欄位規格」。

### 2. 韓國行程 naverQuery（R14）

`meta.countries` 含 `"KR"` 時，新增或修改 POI 須為 location 新增 `naverQuery`。優先精確 place URL `https://map.naver.com/v5/entry/place/{placeId}`，查不到時 fallback 為 `https://map.naver.com/v5/search/{韓文關鍵字}`。

### 3. API 操作選擇

| 操作 | 端點 | 注意 |
|------|------|------|
| 修改單一 entry | `PATCH /api/trips/{tripId}/entries/{eid}` | travel 用 flat fields：`travel_type` / `travel_desc` / `travel_min` |
| 刪除單一 entry | `DELETE /api/trips/{tripId}/entries/{eid}` | **tp-request 禁止此操作**。刪除後須重算相鄰 travel |
| 覆寫整天 | `PUT /api/trips/{tripId}/days/{N}` | 必須含 date + dayOfWeek + label，缺一回 400。travel 用巢狀：`travel: {type, desc, min}`。**tp-request 禁止此操作** |
| 新增 POI | `POST /api/trips/{tripId}/entries/{eid}/trip-pois` | 必填 `name` + `type`；選填 `context`（'timeline' / 'shopping'，預設 timeline） |
| 修改/刪除 POI | `PATCH/DELETE /api/trips/{tripId}/trip-pois/{tpid}` | |
| 更新 doc | `PUT /api/trips/{tripId}/docs/{type}` | doc 結構見上方「Doc 結構規格」 |

### 4. Doc 連動 + travel 重算

- **Doc 連動（鐵律）**：每次修改後檢視 5 種 doc（checklist/backup/suggestions/flights/emergency），更新不一致內容。規則見上方「Doc 連動規則」。
- **travel 重算**：插入/移除/移動 entry 時，重新估算相鄰 entry 的 travel。語意見上方「travel 欄位語意」。

### 5. 驗證

修改後執行 tp-check 精簡 report：`tp-check: 🟢 N  🟡 N  🔴 N`

## 品質規則

R0-R18 完整定義在 `tp-quality-rules/SKILL.md`。各 skill 引用規則編號，不重複定義。
