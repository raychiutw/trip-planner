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

## POI V2 欄位規格

### findOrCreatePoi 支援的完整欄位

pois 表 16 個欄位，API `PUT /days/:num` 的 `findOrCreatePoi` 全部支援。
`PATCH /pois/:id`（admin 端點）也支援所有欄位。

### 各 type 必填 / 建議欄位

| type | 必填 | 建議填 |
|------|------|--------|
| hotel | name, description, checkout, breakfast_included, google_rating, maps | address, phone, mapcode |
| restaurant | name, category, hours, google_rating, maps, price | reservation, reservation_url |
| shopping | name, category, hours, google_rating, maps, must_buy | description |
| parking | name, description, maps | mapcode |

### 資料所有權

- `pois` = AI 維護的 master 資料（google_rating, maps, address 等客觀資訊）
- `trip_pois` = 使用者可覆寫（description, note, checkout 等主觀/行程相關欄位）
- COALESCE convention：trip_pois 欄位 NULL = 繼承 pois master

## googleRating 查詢策略

**優先用 `/browse` 開 Google Maps**（WebSearch 拿不到 Google 評分 — 評分是頁面動態渲染，不在搜尋摘要中）：

1. `/browse` 開 `https://www.google.com/maps/search/{POI名稱}`
2. 從頁面文字抽取第一個 `X.X` 格式數字即為 rating
3. 如果 `/browse` 不可用，fallback：
   a. WebSearch「{名稱} Google Maps 評分」
   b. WebSearch「{名稱} Google rating」
   c. 從 Wanderlog / TripAdvisor / Tabelog 交叉比對
4. 必須是 number 1.0–5.0，找不到時不填預設值

完整搜尋策略詳見 `tp-search-strategies/SKILL.md`。

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
| 板橋出發 | `{car, 國道五號, 60}` = 從板橋開車 60 分到下一站 |
| 幾米廣場 | `null` = 不需移動（下一站在附近） |
| 午餐 | `{car, 宜蘭→冬山, 25}` = 午餐後開車 25 分到梅花湖 |
| 返回板橋 | `null` = 最後一站，無後續移動 |

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

## 品質規則

R0-R18 完整定義在 `tp-quality-rules/SKILL.md`。各 skill 引用規則編號，不重複定義。
