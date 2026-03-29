## Architecture

不新增元件，只擴充現有 API 和 skill。

```
  tp-create / tp-edit / tp-request
       │ 產出 POI 資料（完整欄位）
       ▼
  PUT /api/trips/:id/days/:num
       │ findOrCreatePoi（擴充 5 個欄位）
       ▼
  pois 表（16 欄位全填）
       │
  tp-check R16-R18（驗證完整度）
       │
  tp-patch（補齊缺漏 via PATCH /pois/:id）
```

## Key Decisions

| 決定 | 選擇 | 理由 |
|------|------|------|
| address 寫入方式 | findOrCreatePoi 擴充 | 不需 migration，只改 API |
| 現有資料修復 | backfill 腳本 + PATCH /pois/:id | 用已有的 admin 端點 |
| skill 欄位規格 | 寫在各 skill 的 SKILL.md | 每個 skill 自己知道該填什麼 |
| 品質規則 | tp-check 新增 R16-R18 | 和現有 R0-R15 一致 |
| 飯店 google_rating 補齊 | WebSearch 查詢 | Nominatim 沒有 rating 資料 |
| 方案選擇 | 三端同修（API + Skill + Backfill） | P1 completeness — 只修 API，skill 下次還會漏 |
| COALESCE 語義 | `UPDATE SET col = COALESCE(col, ?)` | P5 explicit — 只填 NULL 不覆蓋已有值 |

## findOrCreatePoi 擴充

現在：
```typescript
findOrCreatePoi(db, { name, type, description, maps, mapcode, lat, lng, google_rating, category, hours, source })
```

改成：
```typescript
findOrCreatePoi(db, { name, type, description, maps, mapcode, lat, lng, google_rating,
  category, hours, source,
  // 新增
  address, phone, email, website, country })
```

找到現有 POI 時（name + type 相同），用 COALESCE 邏輯更新：
```sql
UPDATE pois SET
  address = COALESCE(address, ?),
  phone = COALESCE(phone, ?),
  email = COALESCE(email, ?),
  website = COALESCE(website, ?),
  country = COALESCE(country, ?)
WHERE id = ?
```
只填入目前為 NULL 的欄位，不覆蓋已有值。

## 新增品質規則

| 規則 | 檢查 | 嚴重度 |
|------|------|--------|
| R16 | 飯店 POI 必須有 google_rating | 🟡 warning |
| R17 | 所有 POI 必須有 maps 或 lat/lng（至少一個導航方式） | 🔴 fail |
| R18 | 飯店 POI 建議有 address + phone | 🟡 warning |

## tp-* Skill 欄位規格

### tp-create 產出 POI 時必填

| type | 必填 | 建議填 |
|------|------|--------|
| hotel | name, description, checkout, breakfast_included, google_rating, maps | address, phone, mapcode |
| restaurant | name, category, hours, google_rating, maps, price | reservation, reservation_url |
| shopping | name, category, hours, google_rating, maps, must_buy | description |
| parking | name, description, maps | mapcode |

### tp-patch 更新到 POI V2

現在 tp-patch 操作 trip_entries 的舊欄位。改成：
1. 查 pois 表找缺漏欄位
2. 用 WebSearch 查詢資料
3. 用 `PATCH /pois/:id` 更新 master POI

## Backfill 腳本設計

`scripts/backfill-pois.js`：
1. 查所有 pois WHERE google_rating IS NULL OR maps IS NULL OR address IS NULL
2. 對每個缺漏 POI，用 name + type 組合 WebSearch 查詢
3. 用 `PATCH /pois/:id`（Service Token）更新
4. 輸出報告：補齊了幾個、失敗了幾個
