---
name: tp-patch
description: Use when the user wants to bulk-fill a specific missing field (e.g., googleRating, reservation, location) across one or more trip itineraries using web search.
user-invocable: true
---

跨行程局部欄位更新工具。針對特定 target + field 批次掃描並搜尋補齊，透過 API 寫回。

## API 設定

- **Base URL**: `https://trip-planner-dby.pages.dev`
- **認證**: Service Token headers（寫入操作必填）
  - `CF-Access-Client-Id`: `e5902a9d6f5181b8f70e12f1c11ebca3.access`
  - `CF-Access-Client-Secret`: `9c7d873d558eaf65cdc4160f9ec8f0c06d4f387fc069c7a7e1add0b8196b43a8`

## 指令格式

```
/tp-patch --target <target> --field <field> [--trips <tripId,...>]
```

- `--target`（必填）：`hotel` | `restaurant` | `shop` | `event` | `gasStation`
- `--field`（必填）：`googleRating` | `reservation` | `location` 或其他合法欄位
- `--trips`（選填）：逗號分隔的行程 tripId，預設為所有行程

未提供必填參數時顯示使用說明，不執行操作。

## 步驟

### Phase 1：掃描

1. 取得目標行程清單：
   ```bash
   # 若 --trips 未指定，取得全部行程
   curl -s "https://trip-planner-dby.pages.dev/api/trips?all=1"
   ```
2. 對每個行程讀取所有天資料：
   ```bash
   curl -s "https://trip-planner-dby.pages.dev/api/trips/{tripId}/days"
   # 依序讀取每天完整資料
   curl -s "https://trip-planner-dby.pages.dev/api/trips/{tripId}/days/{N}"
   ```
3. 遍歷所有天，依 `--target` 定位物件：
   - `hotel` → 各天的 hotel 物件（跳過 name 為「家」或以「（」開頭的）
   - `restaurant` → restaurants 陣列內的每個 restaurant
   - `shop` → shopping 陣列內的每個 shop
   - `event` → timeline entries（跳過有 travel 的和「餐廳未定」）
   - `gasStation` → gasStation infoBox
4. 檢查每個物件的 `--field` 是否需要更新：
   - `googleRating`：缺少或非 number → 需更新
   - `reservation`：非 object 或 `available === "unknown"` → 需更新
   - 其他欄位：依實際需求判斷
5. 輸出掃描摘要：「共 N 行程、M 個 {target} 需更新 {field}」+ 每行程明細

### Phase 2：並行搜尋

6. 讀取對應 `--field` 的搜尋策略
7. 為每個行程啟動一個 Agent（sonnet），並行搜尋：
   - Agent prompt 包含該行程需更新的物件清單 + 搜尋方式
   - **依 R13 先驗證 POI 存在性**，搜不到時回報「POI 不存在：{名稱}」，不設 unknown、不繼續搜尋
   - Agent 不直接呼叫 API，只回傳 patch 結果（物件 ID + 新值）
8. 收集所有 Agent 回傳的 patch 結果

### Phase 3：合併與驗證

9. 依 patch 結果呼叫對應 API 寫回：
   - entry（event/hotel）：PATCH `/api/trips/{tripId}/entries/{eid}`
   - 餐廳：PATCH `/api/trips/{tripId}/restaurants/{rid}`
   - 購物：PATCH `/api/trips/{tripId}/shopping/{sid}`

   ```bash
   curl -s -X PATCH \
     -H "CF-Access-Client-Id: e5902a9d6f5181b8f70e12f1c11ebca3.access" \
     -H "CF-Access-Client-Secret: 9c7d873d558eaf65cdc4160f9ec8f0c06d4f387fc069c7a7e1add0b8196b43a8" \
     -H "Content-Type: application/json" \
     -d '{"{field}": {value}}' \
     "https://trip-planner-dby.pages.dev/api/trips/{tripId}/entries/{eid}"
   ```
   - 找不到的值不填預設（`googleRating` 省略、`reservation` 維持 unknown）
10. 對每個修改的行程執行 tp-check 精簡模式
11. 不自動 commit（資料已直接寫入 D1 database）

## 範例

```bash
# 為所有行程的 hotel 補上 googleRating
/tp-patch --target hotel --field googleRating

# 為指定行程的餐廳補上 reservation 結構化資訊
/tp-patch --target restaurant --field reservation --trips okinawa-trip-2026-Ray

# 為指定行程的景點補上 location
/tp-patch --target event --field location --trips okinawa-trip-2026-Ray
```

## 注意事項

- 所有資料讀寫均透過 API，不操作本地 MD 檔案
- 不執行 git commit / push（資料已直接寫入 D1 database）
- 不執行 npm run build（無 dist 產物需產生）
