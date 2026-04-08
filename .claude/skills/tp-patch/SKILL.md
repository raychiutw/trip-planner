---
name: tp-patch
description: Use when bulk-filling missing POI fields (google_rating, maps, address, phone, hours, location) across trips via web search. For single-trip content changes use /tp-edit.
user-invocable: true
---

跨行程 POI 欄位與 entry 座標批次補齊工具。掃描 pois 表缺漏欄位，WebSearch 查詢後用 PATCH 更新。也可為 trip_entries 補齊 location 座標（天氣功能需要）。

API 設定見 `tp-shared/references.md`。

## 指令格式

```
/tp-patch --target <target> --field <field> [--trips <tripId,...>] [--dry-run]
```

- `--target`（必填）：`hotel` | `restaurant` | `shopping` | `parking` | `entry` | `all`
- `--field`（必填）：`google_rating` | `maps` | `address` | `phone` | `hours` | `location` | `all`
- `--trips`（選填）：逗號分隔的行程 tripId，預設為所有行程
- `--dry-run`（選填）：只輸出缺漏報告，不修改資料

未提供必填參數時顯示使用說明，不執行操作。

POI 欄位規格見 `tp-shared/references.md`（pois master vs trip_pois 完整拆分）。

## 步驟

### Phase 1：掃描

1. 取得目標行程清單：
   ```bash
   curl -s "https://trip-planner-dby.pages.dev/api/trips?all=1" \
     -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"
   ```
2. 對每個行程讀取所有天資料，收集所有 POI（含 poi_id）和 entry（含 entry_id）
3. 依 `--target` 篩選：POI type（hotel/restaurant/shopping/parking）或 entry
4. 依 `--field` 檢查缺漏：
   - POI 欄位：NULL 或空字串
   - location：trip_entries.location 為 NULL 或空字串（且該 entry 有 maps 或 title 可供 geocode）
5. 輸出掃描摘要：「共 N 個 {target} 需補齊 {field}」+ 明細

### Phase 2：查詢補齊（依欄位選擇最佳工具）

6. 依欄位類型選擇查詢策略：

   **google_rating → 查詢策略見 tp-shared/references.md「googleRating 查詢策略」**（browse-first，WebSearch 僅做 fallback）

   **maps → 用 POI 名稱作為 Google Maps 搜尋文字**
   - 直接填入 POI 的日文/原文名稱（例如「スーパーホテル沖縄・名護」）
   - 前端會將此文字組成 Google Maps 搜尋 URL

   **address / phone → WebSearch 即可**
   - 搜尋 "{POI name} 住所" 或 "{POI name} 地址"
   - 這類資訊在搜尋摘要中通常有

   **location（geocoding）→ 查詢策略：**
   1. 從 entry 的 `maps` 欄位取得地點名稱（`maps` 是 Google Maps 搜尋 URL，取最後的搜尋詞）
   2. 若 entry 無 `maps`，用 `title` 作為搜尋詞
   3. WebSearch「{地點名稱} 座標 經緯度」或「{地點名稱} GPS coordinates」
   4. 從搜尋結果中提取 lat/lng 數字
   5. 若搜尋不到座標，嘗試用地址搜尋：WebSearch「{地點名稱} 地址」→ 取得地址後再搜尋「{地址} 座標」
   6. 組成 location JSON：`[{name, googleQuery, appleQuery, lat, lng, geocode_status: "ok"}]`

   **同時更新 pois.lat/lng**：若該 entry 有關聯的 POI（透過 trip_pois），且 POI 的 lat/lng 為 NULL，一併用 `PATCH /pois/:id` 更新座標

7. 搜尋不到 → 跳過，不填預設值

### Phase 3：寫入

8. **POI 欄位**（google_rating/maps/address/phone/hours/lat/lng）：
   用 `PATCH /pois/:id` 更新 master POI

9. **location 座標**：
   用 `PATCH /trips/:tripId/entries/:entryId` 更新 trip_entries.location：
   ```bash
   curl -s -X PATCH \
     -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"location": "[{\"name\":\"...\",\"lat\":...,\"lng\":...,\"geocode_status\":\"ok\"}]"}' \
     "https://trip-planner-dby.pages.dev/api/trips/{tripId}/entries/{entryId}"
   ```

   curl 模板見 `tp-shared/references.md`（Windows encoding：用 node writeFileSync + --data @file）。

10. 輸出結果報告：補齊數 / 失敗數 / 仍缺漏數
11. 不自動 commit（資料已直接寫入 D1 database）

## 範例

```bash
# 為所有飯店補上 google_rating
/tp-patch --target hotel --field google_rating

# 只看缺漏報告不修改
/tp-patch --target all --field all --dry-run

# 為指定行程的 POI 補齊所有欄位
/tp-patch --target all --field all --trips okinawa-trip-2026-HuiYun

# 為指定行程補齊 entry 座標（天氣功能需要）
/tp-patch --target entry --field location --trips yilan-trip-2026-banqiaocircle

# 為所有行程補齊座標
/tp-patch --target entry --field location
```

## 注意事項

- 所有資料讀寫均透過 API，不操作本地檔案
- POI 欄位用 `PATCH /pois/:id`（admin 或帶 tripId 的有權限使用者）更新 master POI
- location 座標用 `PATCH /trips/:id/entries/:eid` 更新 trip_entries
- location 更新時若 entry 有關聯 POI，會一併更新 pois.lat/lng
- 不執行 git commit / push
