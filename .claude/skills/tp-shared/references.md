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

## 品質規則

R0-R18 完整定義在 `tp-quality-rules/SKILL.md`。各 skill 引用規則編號，不重複定義。
