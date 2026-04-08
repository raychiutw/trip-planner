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

POI 各 type 必填/建議欄位見 `references/poi-spec.md`。

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
| 更新 doc | `PUT /api/trips/{tripId}/docs/{type}` | doc 結構見 `references/doc-spec.md` |

### 4. Doc 連動 + travel 重算

- **Doc 連動（鐵律）**：每次修改後檢視 5 種 doc（checklist/backup/suggestions/flights/emergency），更新不一致內容。規則見 `references/doc-spec.md`。
- **travel 重算**：插入/移除/移動 entry 時，重新估算相鄰 entry 的 travel。語意見上方「travel 欄位語意」。

### 5. 歇業/不存在 POI 偵測與清理

搜尋 POI 資料（座標、評分、地址等）時，若符合以下任一條件，判定為「歇業或不存在」：

1. **完全查無資料** — WebSearch 搜尋 POI 名稱，在 Tabelog、Google Maps、Hot Pepper、Retty 等平台均無任何結果
2. **明確標示閉店** — 搜尋結果出現「閉店」「closed」「permanently closed」等關鍵字
3. **分店不存在** — 搜尋結果顯示該品牌在目的地無此分店（如「一蘭沖繩只有國際通店」→ ライカム店不存在）

**處理流程：**

1. 用 `DELETE /api/trips/{tripId}/trip-pois/{tpid}` 刪除該 POI 的 trip_pois 關聯
2. 在結果報告中列出已移除的 POI 及判定原因
3. pois master 不刪除（保留紀錄，且可能被其他行程引用）

**注意：** 僅在「搜尋 POI 資料」的場景觸發（tp-patch、tp-rebuild、tp-request 補資料時）。tp-create 建立新行程時不會觸發（因為是新增 POI，不是查既有的）。

### 6. 驗證

修改後執行 tp-check 精簡 report：`tp-check: 🟢 N  🟡 N  🔴 N`
