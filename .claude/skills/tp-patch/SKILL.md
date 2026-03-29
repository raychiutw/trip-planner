---
name: tp-patch
description: Use when the user wants to bulk-fill a specific missing field (e.g., googleRating, reservation, location) across one or more trip itineraries using web search.
user-invocable: true
---

跨行程 POI 欄位批次補齊工具。掃描 pois 表缺漏欄位，WebSearch 查詢後用 PATCH /pois/:id 更新。

## API 設定

- **Base URL**: `https://trip-planner-dby.pages.dev`
- **認證**: Service Token headers（寫入操作必填）
  - `CF-Access-Client-Id`: `$CF_ACCESS_CLIENT_ID`
  - `CF-Access-Client-Secret`: `$CF_ACCESS_CLIENT_SECRET`

## 指令格式

```
/tp-patch --target <target> --field <field> [--trips <tripId,...>] [--dry-run]
```

- `--target`（必填）：`hotel` | `restaurant` | `shopping` | `parking` | `all`
- `--field`（必填）：`google_rating` | `maps` | `address` | `phone` | `hours` | `all`
- `--trips`（選填）：逗號分隔的行程 tripId，預設為所有行程
- `--dry-run`（選填）：只輸出缺漏報告，不修改資料

未提供必填參數時顯示使用說明，不執行操作。

## POI V2 欄位規格

| type | 必填 | 建議填 |
|------|------|--------|
| hotel | name, description, google_rating, maps, checkout | address, phone, mapcode |
| restaurant | name, category, hours, google_rating, maps | price, reservation |
| shopping | name, category, hours, google_rating, maps | must_buy, description |
| parking | name, description, maps | mapcode |

## 步驟

### Phase 1：掃描 pois 表

1. 取得目標行程清單：
   ```bash
   curl -s "https://trip-planner-dby.pages.dev/api/trips?all=1" \
     -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"
   ```
2. 對每個行程讀取所有天資料，收集所有 POI（含 poi_id）
3. 依 `--target` 篩選 POI type
4. 依 `--field` 檢查哪些 POI 缺漏該欄位（NULL 或空字串）
5. 輸出掃描摘要：「共 N 個 {target} 需補齊 {field}」+ 明細

### Phase 2：WebSearch 補齊

6. 為每個缺漏 POI，用 name + type 組合 WebSearch 查詢
   - google_rating → 搜尋 "Google Maps {POI name} rating"
   - maps → 搜尋 "Google Maps {POI name}"，取 URL
   - address → 搜尋 "{POI name} 地址"
   - phone → 搜尋 "{POI name} 電話"
7. 搜尋不到 → 跳過，不填預設值

### Phase 3：寫入（PATCH /pois/:id）

8. 用 `PATCH /pois/:id` 更新 master POI：

   > ⚠️ Windows encoding 注意：curl -d 中的中文在 Windows shell 會變亂碼，一律用 node writeFileSync + --data @file

   ```bash
   node -e "require('fs').writeFileSync('/tmp/patch.json', JSON.stringify({google_rating: 4.5, address: '...'}), 'utf8')"
   curl -s -X PATCH \
     -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
     -H "Content-Type: application/json" \
     -H "Origin: https://trip-planner-dby.pages.dev" \
     --data @/tmp/patch.json \
     "https://trip-planner-dby.pages.dev/api/pois/{poiId}"
   ```

9. 輸出結果報告：補齊數 / 失敗數 / 仍缺漏數
10. 不自動 commit（資料已直接寫入 D1 database）

## 範例

```bash
# 為所有飯店補上 google_rating
/tp-patch --target hotel --field google_rating

# 只看缺漏報告不修改
/tp-patch --target all --field all --dry-run

# 為指定行程的 POI 補齊所有欄位
/tp-patch --target all --field all --trips okinawa-trip-2026-HuiYun
```

## 注意事項

- 所有資料讀寫均透過 API，不操作本地檔案
- 使用 `PATCH /pois/:id`（admin 端點）更新 master POI，不是 trip_pois
- 不執行 git commit / push
