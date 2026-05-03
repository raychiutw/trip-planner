# 行程修改共用步驟

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

## 行程修改共用步驟

tp-edit、tp-request、tp-rebuild 修改行程資料時的共用流程：

### 1. POI 必填欄位（新增或替換時）

| 欄位 | 規則 | 說明 |
|------|------|------|
| `source` | R13 | 使用者明確指定名稱 → `"user"`；模糊描述 → `"ai"` |
| `note` | R15 | 有備註填內容，無備註填空字串 `""` |
| `location.googleQuery` 或 `maps` | R11 | PATCH /entries 用 `location`（JSON 字串 `{"name":"...", "googleQuery":"..."}`）；PUT /days 用 `maps`（純搜尋文字） |
| `googleRating` | R12 | 1.0-5.0，`source: "ai"` 必填，`source: "user"` 盡量填。查詢策略見 `references/poi-spec.md` |

### 1b. Entry location 座標（鐵律）

> ⚠️ **每個實體地點 entry 必須有 lat/lng 座標。** 缺座標 = 天氣功能失效 + 地圖無法顯示 + travel 無法計算。

**查詢方式**：用 Google Maps 搜尋 `maps` 欄位的文字，從結果取得 lat/lng。WebSearch 查「{地點名} 座標」或「{地點名} Google Maps」。

**PATCH 格式**：
```json
PATCH /entries/:eid
{"location": "[{\"name\":\"地點名\",\"lat\":26.xx,\"lng\":127.xx,\"geocode_status\":\"ok\"}]"}
```

**時機**：
- tp-create：PUT /days 建立 entry 後，同 Phase 內立即 PATCH 補座標（不得延遲到其他 Phase）
- tp-edit：新增或替換 entry 時，一併 PATCH location
- tp-patch：`--target entry --field location` 批次補齊

**排除**：純交通 entry（「出發」「搭巴士」「起飛」）且無固定地點者可省略。有明確地點的交通 entry（如「那霸機場」「道之驛許田」）仍須填座標。

POI 各 type 必填/建議欄位見 `references/poi-spec.md`。

### 2. 韓國行程 naverQuery（R14）

`meta.countries` 含 `"KR"` 時，新增或修改 POI 須為 location 新增 `naverQuery`。優先精確 place URL `https://map.naver.com/v5/entry/place/{placeId}`，查不到時 fallback 為 `https://map.naver.com/v5/search/{韓文關鍵字}`。

### 3. API 操作選擇

| 操作 | 端點 | 注意 |
|------|------|------|
| 新增 entry | `POST /api/trips/{tripId}/days/{dayNum}/entries` | 必填 `title`；選填 `sort_order`（省略則 append 到最後）、`time`、`description`、`maps` 等。回 201 |
| 修改單一 entry | `PATCH /api/trips/{tripId}/entries/{eid}` | travel 用 flat fields：`travel_type` / `travel_desc` / `travel_min` |
| 刪除單一 entry | `DELETE /api/trips/{tripId}/entries/{eid}` | **tp-request 禁止此操作**。刪除後須重算相鄰 travel |
| 覆寫整天 | `PUT /api/trips/{tripId}/days/{N}` | 必須含 date + dayOfWeek + label，缺一回 400。travel 用巢狀：`travel: {type, desc, min}`。**tp-request 禁止此操作** |
| 新增 POI | `POST /api/trips/{tripId}/entries/{eid}/trip-pois` | 必填 `name` + `type`；選填 `context`（'timeline' / 'shopping'，預設 timeline） |
| 修改/刪除 POI | `PATCH/DELETE /api/trips/{tripId}/trip-pois/{tpid}` | |
| 更新 doc | `PUT /api/trips/{tripId}/docs/{type}` | doc 結構見 `references/doc-spec.md` |

### 4. Doc 連動 + travel 重算

- **Doc 連動（鐵律）**：每次修改後檢視 5 種 doc（checklist/backup/suggestions/flights/emergency），更新不一致內容。規則見 `references/doc-spec.md`。
- **travel 重算（鐵律）**：以下情況須重新估算 **前一站→本站** 和 **本站→下一站** 兩段 travel，語意見上方「travel 欄位語意」：
  1. **插入/移除/移動 entry 時** — 前一站的 travel 指向變了，必須重算
  2. **替換 entry 地點時** — 景點換了位置，前後車程都變
  3. **餐廳首選變動時** — meal entry（早餐/午餐/晚餐）的 sort_order=0 餐廳新增、替換或刪除時，用新首選餐廳的 lat/lng 重算前後兩段車程
  
  **計算方式**：用前後 entry 的 location lat/lng（meal entry 用首選餐廳的 lat/lng），以 Haversine 距離估算。自駕 ~30km/h，步行 ~5km/h，同區域 <500m 用 walk。PATCH `travel_type` / `travel_desc` / `travel_min`。

### 5. Google Maps 驗證與歇業偵測（鐵律）

**Google Maps 是 POI 的 source of truth。** 所有 tp-* skills（含 tp-create）新增或更新 POI 時，必須先通過 Google Maps 驗證。驗證流程見 `tp-search-strategies` SKILL.md「前置步驟：Google Maps 驗證」。

若 Google Maps 查不到，或符合以下任一條件，判定為「無效 / 歇業 / 不存在」：

1. **Google Maps 查無此 POI** — WebSearch「{名稱} {地區} Google Maps」無法找到對應的 Google Maps 頁面
2. **明確標示閉店** — 搜尋結果出現「閉店」「closed」「permanently closed」等關鍵字
3. **分店不存在** — 搜尋結果顯示該品牌在目的地無此分店（如「一蘭沖繩只有國際通店」→ ライカム店不存在）

**處理流程：**

- **tp-create（新增行程）**：不新增該 POI，改用 Google Maps 上可查到的替代店家
- **tp-edit / tp-request（修改行程）**：不新增該 POI，回報無效原因，建議替代
- **tp-request（旅伴觸發）**：
  1. 用 `DELETE /api/trips/{tripId}/trip-pois/{tpid}` 刪除該 POI 的 trip_pois 關聯
  2. **不可刪 pois master**（旅伴無此權限）
  3. 在回覆中告知旅伴該 POI 已移除及原因
- **tp-patch / tp-rebuild / admin 指示（歇業偵測或 admin 要求）**：
  1. 用 `DELETE /api/trips/{tripId}/trip-pois/{tpid}` 刪除該 POI 的所有 trip_pois 關聯
  2. 用 `DELETE /api/pois/{poi_id}` 刪除 pois master（Google Maps 不存在/歇業，或 admin 明確要求時）
  3. 在結果報告中列出已移除的 POI 及判定原因

### 6. 驗證

修改後執行 tp-check 精簡 report：`tp-check: 🟢 N  🟡 N  🔴 N`
