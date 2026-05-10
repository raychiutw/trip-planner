# POI 欄位規格與查詢策略

## POI 欄位規格

### findOrCreatePoi 支援的完整欄位

pois 表欄位（id, type, name, description, note, address, phone, email, website, hours, rating, price, category, mapcode, lat, lng, country, source, place_id, status, status_reason, status_checked_at, last_refreshed_at, created_at, updated_at），API `PUT /days/:num` 的 `findOrCreatePoi` 全部支援。
`PATCH /pois/:id`（admin 或帶 tripId 的有權限使用者）也支援所有欄位。

> ⚠️ Migration 0045 (v2.19.x) 把 `pois.google_rating` 重命名為 `pois.rating`。新 code 一律用 `rating`；frontend `entry.googleRating` 是 mapDay 從 `poi.rating` 接出的 alias，DB 端不存在 `google_rating` col。

### 各 type 必填 / 建議欄位

> ⚠️ pois master 與 trip_pois override 的欄位不同。checkout / breakfast_* / reservation* / must_buy 是 **trip_pois 欄位**，PATCH /pois/:id 不接受。

**pois master（PATCH /pois/:id 可修改）：**

| type | 必填 | 建議填 |
|------|------|--------|
| hotel | name, rating | description, address, phone, mapcode, hours |
| restaurant | name, category, hours, rating | description, phone, address, **price** |
| shopping | name, category, hours, rating | description, phone, address |
| parking | name, description | mapcode, hours |
| attraction | name, rating | description, hours, address, phone |
| transport | name | description, hours |
| activity | name, rating, hours | description, phone, website |

> ⚠️ **2026-05-10 (migration 0054)**：`price` 欄位從 `trip_pois` 移到 `pois` master。語意：餐廳定價是客觀屬性（不會因 trip 而異），跟 rating/address/phone 同列。寫入路徑：`POST /trip-pois` body 帶 `price` 會寫進 `pois.price`（透過 findOrCreatePoi）；`PATCH /pois/:id` 直接接受 `price`。`PATCH /trip-pois/:tpid` 帶 `price` 會被 `POI_MASTER_ONLY_FIELDS` dispatch 到 pois。讀取路徑：v2.25.4 dual-read（`pois.price ?? trip_pois.price`）；migration 0055 後改純 `pois.price`。

> ⚠️ **2026-05-10 (migration 0055)**：`hours` 欄位從 `trip_pois` 移除（DROP COLUMN），純 `pois.hours`。語意：營業時間是 POI 客觀屬性。寫入：`findOrCreatePoi` 接受 hours；`PATCH /pois/:id` 直接接受；`PATCH /trip-pois/:tpid` 帶 hours auto-dispatch 到 pois。Place Details API `weekday_descriptions` 已含**全週時段 + 公休日**（例「星期三: 休息」），不需額外處理定休日欄位。

**trip_pois override（PATCH /trip-pois/:tpid 可修改）：**

| type | 可覆寫欄位 |
|------|-----------|
| hotel | description, note, checkout, breakfast_included, breakfast_note |
| restaurant | description, note, reservation, reservation_url |
| shopping | description, note, must_buy |

pois.type 允許值：`hotel`, `restaurant`, `shopping`, `parking`, `attraction`, `transport`, `activity`, `other`（v2.1.2.0+ 納入 `activity`）

### Phase 2 POI Unification：timeline entry 的 POI master（v2.1.2.0+）

每個 timeline entry 都會對應一筆 pois master，透過 `trip_entries.poi_id` FK 關聯。PUT /days/:num 與 POST /entries 會自動 find-or-create。

- `poi_type`（body 欄位，選填）：決定這個 entry 的 POI 屬於哪一類。**預設 `attraction`**。
  - `transport`：機場、車站、港口、碼頭（`title` 含「機場 / 空港 / 港 / 碼頭 / 站 / 駅 / airport / station / port」時必傳）
  - `activity`：需預訂的體驗活動（浮潛、玉泉洞、鳳梨園、工作坊等，有 reservation 且耗時 > 1h）
  - `attraction`：一般景點（寺廟、公園、城堡、海灘、觀景台）
- 其餘欄位（`mapcode`, `lat`, `lng`, `rating`, `description`）會流進 pois master，由 find-or-create 用 `UNIQUE(name, type)` 去重（同 name + type 共享同一筆 pois row）。
- PATCH /entries/:eid 可傳 `poi_id` 重新指向既有 POI master（例如統一兩個 entry 用同 POI）。

### 資料所有權

- `pois` = AI 維護的 master 資料（rating, address, hours, price 等客觀資訊）
- `trip_pois` = 使用者可覆寫（description, note, checkout 等主觀/行程相關欄位）
- COALESCE convention：trip_pois 欄位 NULL = 繼承 pois master

### API 操作端點

| 操作 | 端點 | 說明 |
|------|------|------|
| 新增 entry | `POST /api/trips/{id}/days/{dayNum}/entries` | 必填 `title`，選填 `sort_order`（省略 append 到最後） |
| 新增 POI 到 entry | `POST /api/trips/{id}/entries/{eid}/trip-pois` | 餐廳、購物統一端點 |
| 修改 trip_pois | `PATCH /api/trips/{id}/trip-pois/{tpid}` | 覆寫欄位；POI master 欄位（hours/price 等）auto-dispatch 到 pois |
| 刪除 trip_pois | `DELETE /api/trips/{id}/trip-pois/{tpid}` | 移除關聯 |
| 修改 pois master | `PATCH /api/pois/{id}` | admin 或帶 `tripId` 的有權限使用者 |
| 刪除 pois master | `DELETE /api/pois/{id}` | admin only，會一併刪除所有關聯 trip_pois |
| **POI 補資料 / refresh（首選）** | `POST /api/pois/{id}/enrich` | **backend 直接打 Google Place Details API，自動寫 rating/address/phone/hours + business_status lifecycle。優先用此 endpoint 而非手動 PATCH。** |

## POI 補資料策略（migration 0051+ 後 v2.23.0）

### 第一原則：用 backend enrich endpoint，不爬網頁

**`POST /api/pois/{id}/enrich`** 是 source of truth。Backend 直接打 Google Place Details API（API Routes v1）拿：

- `rating`（1.0–5.0）
- `lat / lng`（4 位小數）
- `address`（formatted_address，含縣市區番地）
- `phone`（international_phone_number，E.164 `+81-XX-XXXX-XXXX`）
- `hours`（regular_opening_hours.weekday_descriptions，**全週時段 + 公休日**）
- `business_status`（→ pois.status：active / closed / missing）

寫入規則：
- COALESCE 保留 NULL，覆蓋既有值（new non-null > old）
- 同步寫 `last_refreshed_at` + `status_checked_at`

### 觸發場景

| 場景 | 動作 |
|------|------|
| LLM 補單一 POI 缺漏欄位 | `POST /api/pois/{poi_id}/enrich`（admin token 或帶 `?tripId={id}`） |
| 跨行程批次補資料 | `/tp-patch` skill 用 admin token 對所有 `place_id IS NOT NULL AND status='active'` 的 POI loop call enrich |
| 既有 cron refresh | `scripts/google-poi-refresh-30d.ts` 自動跑（50/day quota cap，每月所有 active POI 滾動更新一次） |
| 新增 POI 缺 place_id | 先用 `findOrCreatePoi` 建 pois 行 → 跑 `POST /api/poi-search` 取 place_id 寫回 → 再 enrich |

### 範例：批次補

```bash
TOKEN=$(cat /tmp/admin-token.txt)
# 取得 1 hour TTL admin token via OAuth client_credentials:
#   curl -X POST https://trip-planner-dby.pages.dev/api/oauth/token \
#     -H "Content-Type: application/x-www-form-urlencoded" \
#     -d "grant_type=client_credentials&client_id=$CID&client_secret=$CSEC&scope=admin"

# 取得需 enrich 的 POI（有 place_id + active + 缺漏 hours/address/phone）
npx wrangler d1 execute trip-planner-db --remote --command "
SELECT id, name FROM pois
WHERE place_id IS NOT NULL AND status='active'
  AND (hours IS NULL OR address IS NULL OR phone IS NULL)
" --json

# 對每筆 POST enrich
for pid in 458 467 489 ...; do
  curl -s -X POST -H "Authorization: Bearer $TOKEN" \
    "https://trip-planner-dby.pages.dev/api/pois/$pid/enrich"
  sleep 0.6  # rate limit (autoplan T11 50/day cap built into pois-due-refresh endpoint)
done
```

### 不要做的事（anti-patterns）

| ❌ Anti-pattern | ✅ 正確做法 |
|---|---|
| `/browse` 爬 Google Maps 詳情頁手動抽 | `POST /api/pois/:id/enrich` |
| WebSearch「POI 名稱 營業時間」 | 同上 |
| LLM 直接打 Google Place Details API（key 暴露 + quota 失控） | 同上（透過 backend 統一管理 quota） |
| `PATCH /pois/:id` 手動寫 hours/address/phone | enrich 自動處理（除非用戶要 manual override） |

`/browse` Google Maps 對未登入訪客限制了 hours panel（只看到當日），且 raw text 抽取易被相鄰元素污染。WebSearch 摘要雖然偶爾完整，但聚合多 source 結果不一致。**只有 enrich endpoint 拿到 Google Place Details API 的權威結構化資料**。

## Google Maps 驗證（鐵律）

**Google Maps 是所有 POI 資料的 source of truth。** 新增或更新 POI 前，必須先確認 Google Maps 上存在該 POI（透過 `POST /api/poi-search` text search，回傳 place_id + 基本資訊）。查不到 = 無效，不得新增或保留。

驗證流程：

1. `POST /api/poi-search` body `{ query: "POI 名稱 城市" }` → 拿 results array
2. 取第一個結果的 `place_id`（必填，沒 place_id 不能 enrich）
3. `findOrCreatePoi` 建 pois 行 + 寫 `place_id`
4. `POST /api/pois/{id}/enrich` 補完整欄位

### 歇業偵測 / 不存在 POI 處理

`POST /api/pois/:id/enrich` 自動處理：
- Place Details API 回 `business_status='CLOSED_PERMANENTLY'` → `pois.status='closed' + status_reason='永久歇業'`
- Place Details API 404 → `pois.status='missing' + status_reason='Google Maps 查無資料'`
- `business_status='CLOSED_TEMPORARILY'` → 仍 `status='active'`（暫時性，不警告）

`status='closed'` 或 `status='missing'` 的 POI：依 `modify-steps.md §5` 流程刪除。

### 必填驗證

新增或替換 POI 時，至少 `name + place_id` 必填。lat/lng/address/phone/hours 由 enrich 補。
