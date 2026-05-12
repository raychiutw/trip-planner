# Restaurants → Alternates Migration (v2.28.0)

**Date**: 2026-05-12
**Triggered by**: v2.27.0 deploy 後 user 反映 entry 424 「備案餐廳沒進備選名單」
**Status**: Draft — 待 signoff

## Problem

v2.27.0 multi-POI per entry 引入 `master + alternates` 概念，但**沒**處理 legacy `entry.restaurants[]` 概念。

```
Entry 424「美國村晚餐＋散步」:
  master:     美國村 (attraction)
  alternates: []         ← v2.27.0 新概念，空的
  restaurants: 2 個      ← legacy 概念，user 認知中的「備案餐廳」
```

User 心智模型：「備案餐廳就是備選」。技術現實：兩個分離 data model。

## Goal

把 legacy `restaurants` 表 **完整** migrate 進 v2.27.0 的 `trip_entry_pois + trip_pois` 體系，最終 DROP restaurants 表。

## Data Mapping

`Restaurant` 欄位 → 目標欄位（pois master vs trip_pois override）：

| Restaurant 欄位 | 目標 | 理由 |
|----------------|------|------|
| name | pois.name | POI 共享屬性 |
| lat / lng | pois.lat / pois.lng | 空間屬性 |
| category | pois.category | POI 共享屬性 |
| hours | pois.hours | v2.25.5 後 hours 純 pois master |
| googleRating | pois.rating | v2.19 後 googleRating → rating |
| maps | (drop) | v2.19 後 pois.maps DROPPED |
| mapcode | pois.mapcode | POI 共享屬性 |
| source | pois.source | POI 共享屬性 |
| price | pois.price | v2.25.4 後 price 純 pois master |
| description | trip_pois.description | trip-specific override |
| note | trip_pois.note | trip-specific note |
| reservation | trip_pois.reservation | trip-specific 預約狀態 |
| reservationUrl | trip_pois.reservation_url | trip-specific 預約連結 |
| entryId | trip_entry_pois.entry_id + trip_pois.entry_id | M:N 關聯 |
| sortOrder | trip_entry_pois.sort_order (max+1+restaurant_sortOrder) | alternates 排序 |

POI type 強制 `'restaurant'`。

## Phase 1 — Migration 0059 + dual-read/write (v2.28.0)

### Migration 0059 SQL

```sql
-- 對每個 restaurant row：
-- 1. find-or-create pois 對應 row (by name + lat/lng + type='restaurant')
-- 2. INSERT trip_entry_pois (entry_id, poi_id, sort_order = max+1)
-- 3. INSERT trip_pois (context='timeline', entry_id, day_id, sort_order)
--    含 price/reservation/reservation_url/description/note

-- 不能用單一 SQL — 需要 application-layer loop（POI find-or-create + 計算 sort_order）。
-- 寫成 standalone migration script (scripts/migrate-0059-restaurants-to-alternates.js)
-- 不是 wrangler migrations apply 自動跑，而是 manual run via npm script。
```

**為什麼不是純 SQL migration**:
- POI find-or-create 需要 application logic (避免 dup POIs)
- sort_order 計算需要 per-entry MAX
- trip_id 需要 JOIN trip_entries → trip_days → trip_id

### Backend changes

**`functions/api/trips/[id]/days/_merge.ts`** assembleDay:
- 目前：`restByEntry.get(eid)` → `entry.restaurants[]` 從 trip_pois context='timeline' 組起來
- **過渡期**：保留 `entry.restaurants[]` (dual-read from legacy restaurants table OR trip_pois)
- alternates 路徑：trip_entry_pois sort_order > 1 already populated by `fetchEntryPoisByEntries`
- alternates response 加 restaurant fields when type='restaurant'：
  ```ts
  {
    poiId, name, lat, lng, type, category, sortOrder,
    // type='restaurant' 才有：
    hours, googleRating, price,         // pois master
    reservation, reservationUrl,         // trip_pois override
    description, note,                    // trip_pois override
  }
  ```

**POST /api/trips/:id/entries/:eid/restaurants** (dual-write):
- 既有路徑：INSERT restaurants
- 新增：同時 INSERT trip_entry_pois + trip_pois (context='timeline')
- 直到 Phase 2 為止保留 dual-write

**DELETE / PATCH /restaurants** 對應 dual-write。

### Frontend changes

**`src/pages/EditEntryPage.tsx`** alternates section：
- 既有 row：`[圖示] {name} ({type label}) [↑↓] [設為首選] [×]`
- 加 restaurant 專屬 inline info：`{price · hours · reservation status}` 在 row 下方第二行
- 「加備案」CTA：v2.27.0 sign-off 已含「從搜尋 / 從收藏」入口

`src/types/trip.ts` `EntryPoiAlternate` extend：
```ts
export interface EntryPoiAlternate extends EntryPoiInfo {
  sortOrder: number;
  // v2.28.0 — restaurant POIs 額外屬性
  hours?: string | null;
  googleRating?: number | null;
  price?: string | null;
  reservation?: string | null;
  reservationUrl?: string | null;
  description?: string | null;
  note?: string | null;
}
```

**TripPage timeline rendering**：
- 目前：entry 下方列 entry.restaurants[] 為子項目
- Phase 1 過渡：保留現狀（dual-read 仍 surface restaurants[]）
- Phase 2：改讀 alternates with type='restaurant' (或保留 restaurants 子項目顯示但資料源改 alternates)

## Phase 2 — Migration 0060 DROP restaurants (v2.28.x or v2.29.0)

觀察期 ≥2 週確認 dual-write 沒 drift：
```sql
-- monitoring query (應該全 0)：
SELECT r.id FROM restaurants r
LEFT JOIN trip_entry_pois tep ON tep.entry_id = r.entry_id
LEFT JOIN pois p ON p.id = tep.poi_id AND p.name = r.name
WHERE tep.id IS NULL;
```

Cutover steps:
1. Backend 停止 dual-write，POST /restaurants 改寫到 alternates
2. `entry.restaurants[]` response 改 fallback 到 alternates with type='restaurant' (cosmetic shape 保留)
3. Frontend TripPage timeline 改讀 alternates with type='restaurant' 而非 entry.restaurants
4. Migration 0060 `DROP TABLE restaurants`

## Risks

1. **POI duplication risk**：find-or-create by (name, lat, lng) 在 NULL lat/lng 時可能誤合併不同 POI。需要 fallback by name only with type=restaurant + log warnings.
2. **Sort order conflicts**：migration backfill 同時跑時若 trip_entry_pois 已有 alternates (v2.27.0 user 加過)，sort_order 計算要 atomic max+1。
3. **Reservation status data loss**：trip_pois.reservation 已存在但目前不太用，migration 後 EditEntryPage 要 surface 出來不然 user 看不到原有預約狀態。
4. **Dual-write race**：POST /restaurants + addAlternate 並發時可能撞 UNIQUE (entry_id, poi_id)。需要 catch + retry。
5. **trip_pois.reservation_url 命名**：DB col snake_case `reservation_url`，API response camelCase `reservationUrl`。確認 deepCamel 一致。

## Test plan

- Unit: migration 0059 backfill script — 各種 edge cases (NULL lat/lng, dup names, empty restaurants)
- Integration:
  - GET /days/:num returns alternates with restaurant fields
  - POST /restaurants dual-write creates trip_entry_pois + trip_pois rows
  - DELETE /restaurants dual-delete
  - addAlternate on restaurant-type POI keeps restaurant fields
- Frontend: EditEntryPage alternates row renders price/hours/reservation when type='restaurant'

## Open questions

1. **Migration script 是否 idempotent?** 重跑必須不重複建 trip_entry_pois rows。用 INSERT OR IGNORE on UNIQUE (entry_id, poi_id) 處理。
2. **Restaurant 的 maps / mapcode 怎麼處理？** v2.19 後 pois.maps DROPPED，但 restaurant.maps 還在。drop 掉？
3. **Phase 2 timing**：v2.28.0 ship 後多久跑 Phase 2？建議 2 週 observation。
4. **TripPage timeline 顯示**：alternates with type='restaurant' 是否仍以子項目方式顯示在 entry 下方？還是純粹進 EditEntryPage alternates list？

## Estimated work

- Phase 1: 3-4 hr CC (migration script + backend dual-write + frontend rendering + tests + design review)
- Phase 2: 1-2 hr CC (DROP migration + cleanup code)
