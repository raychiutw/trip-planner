# Plan: POI Schema V2 — 正規化 + 零 JSON + 資料所有權

**Status: APPROVED** (autoplan 三審通過 2026-03-28，17/17 findings 全部採納)

## 動機

### Phase 1 已完成（v1.1.1.0）
- ✅ 欄位名稱統一（body→description, rating→google_rating）
- ✅ 表名統一（trip_ 前綴）
- ✅ mapRow pipeline 接線
- ✅ MarkdownText 渲染

### Phase 2 問題
1. **pois/trip_pois 空殼**：migration 0014 建了表但零資料、零 API
2. **三張獨立表不合理**：hotels/restaurants/shopping 各自為政，同一 POI 跨行程無法共用
3. **JSON 欄位違反正規化**：location 存 JSON、attrs 存 JSON
4. **停車場寄生在飯店**：parking 是 JSON 塞在 hotels.parking
5. **資料所有權不明**：user 修改和 AI 生成混在同一欄位

---

## 核心設計

### POI = git repo 類比

```
pois（upstream master）— AI 維護，user 不可直接改
  │  名稱、地址、電話、評分、營業時間、座標
  │
  ├── trip A 的 trip_pois（fork）→ user 可覆寫 description/note
  ├── trip B 的 trip_pois（fork）→ user 可覆寫 description/note
  │
  寫入規則：
  - tp-create  → INSERT pois (AI 生成) + INSERT trip_pois (引用)
  - tp-edit    → user 說「改描述為 X」→ UPDATE trip_pois (user 覆寫)
               → user 說「重寫介紹」→ AI 重新生成 → UPDATE pois (master)
  - tp-patch   → UPDATE pois (客觀欄位: google_rating/hours/phone)
  - user PUT   → UPDATE trip_pois only（禁止直接改 pois）

  sync：
  - master → fork：JOIN 天然最新（未覆寫欄位自動跟進）
  - fork → master：skill 更新客觀欄位時回寫 master
```

---

## 新 DB Schema

### `pois`（master — 零 JSON）

```sql
CREATE TABLE pois (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT NOT NULL CHECK (type IN ('hotel','restaurant','shopping','parking','attraction','transport','other')),
  name          TEXT NOT NULL,
  description   TEXT,
  note          TEXT,
  address       TEXT,
  phone         TEXT,
  email         TEXT,
  website       TEXT,
  hours         TEXT,
  google_rating REAL,
  category      TEXT,
  maps          TEXT,
  mapcode       TEXT,
  lat           REAL,              -- 不再是 JSON
  lng           REAL,              -- 不再是 JSON
  country       TEXT DEFAULT 'JP',
  source        TEXT DEFAULT 'ai',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_pois_type ON pois(type);
CREATE INDEX idx_pois_name ON pois(name);
```

### `trip_pois`（trip 引用 — user 可覆寫，類型欄位扁平化）

```sql
CREATE TABLE trip_pois (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id             TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  poi_id              INTEGER NOT NULL REFERENCES pois(id),
  context             TEXT NOT NULL CHECK (context IN ('hotel','timeline','shopping')),
  day_id              INTEGER REFERENCES trip_days(id) ON DELETE CASCADE,
  entry_id            INTEGER REFERENCES trip_entries(id) ON DELETE CASCADE,
  sort_order          INTEGER DEFAULT 0,
  -- 覆寫欄位（NULL = 用 master）
  description         TEXT,
  note                TEXT,
  hours               TEXT,
  -- 類型專屬欄位（扁平化，nullable — 審查 C1 採納）
  checkout            TEXT,            -- hotel
  breakfast_included  INTEGER,         -- hotel (0/1/NULL)
  breakfast_note      TEXT,            -- hotel
  price               TEXT,            -- restaurant
  reservation         TEXT,            -- restaurant
  reservation_url     TEXT,            -- restaurant
  must_buy            TEXT,            -- shopping
  -- meta
  source              TEXT DEFAULT 'ai',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),

  CHECK (
    (context = 'hotel' AND day_id IS NOT NULL) OR
    (context IN ('timeline','shopping') AND (entry_id IS NOT NULL OR day_id IS NOT NULL))
  )
);

CREATE INDEX idx_trip_pois_trip ON trip_pois(trip_id);
CREATE INDEX idx_trip_pois_poi ON trip_pois(poi_id);
CREATE INDEX idx_trip_pois_day ON trip_pois(day_id);
CREATE INDEX idx_trip_pois_entry ON trip_pois(entry_id);
```

> **設計決策（C1）**：extension tables 扁平化進 trip_pois。7 個 nullable columns 比 3 張額外表 + 3 JOIN 更簡單。SQLite NULL 幾乎零成本。

> **覆寫慣例（C4）**：`NULL = 繼承 master`。無法表達「刻意留空」，接受此限制。

### `poi_relations`（master 層級 POI 關聯 — 多對多）

```sql
CREATE TABLE poi_relations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  poi_id          INTEGER NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  related_poi_id  INTEGER NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  relation_type   TEXT NOT NULL CHECK (relation_type IN ('parking','nearby')),
  note            TEXT,
  UNIQUE(poi_id, related_poi_id, relation_type)
);
```

> 停車場↔飯店是現實世界的關聯，屬 master 層級。一個停車場可服務多間飯店，一間飯店可有多個停車場。

### 停車場處理

```
情況 A：有具體停車場（名稱+位置+價格）
  → pois (type='parking', name='タイムズ北谷', lat/lng, ...)
  → poi_relations (poi_id=飯店, related_poi_id=停車場, type='parking')
  → trip_pois 單獨建一筆（同天 day_id, context='hotel'）
  判斷規則：parking.name 存在 AND (parking.lat/lng 或 parking.maps 存在)

情況 B：只是停車說明（「飯店有免費停車」）
  → 寫在飯店 pois.description 的「停車」段落中
  判斷規則：無 parking.name 或無位置資訊
```

---

## API 查詢模式

### GET /api/trips/:id/days/:num

```sql
-- 飯店（2-table JOIN，無 extension table）
SELECT p.*, tp.id AS trip_poi_id,
       tp.description AS tp_description, tp.note AS tp_note, tp.hours AS tp_hours,
       tp.checkout, tp.breakfast_included, tp.breakfast_note
FROM trip_pois tp
JOIN pois p ON tp.poi_id = p.id
WHERE tp.trip_id = ? AND tp.day_id = ? AND tp.context = 'hotel' AND p.type = 'hotel';

-- 飯店的停車場（同天、type=parking）
SELECT p.*, tp.id AS trip_poi_id, tp.description AS tp_description, tp.note AS tp_note
FROM trip_pois tp
JOIN pois p ON tp.poi_id = p.id
WHERE tp.trip_id = ? AND tp.day_id = ? AND tp.context = 'hotel' AND p.type = 'parking';

-- 餐廳
SELECT p.*, tp.id AS trip_poi_id,
       tp.description AS tp_description, tp.note AS tp_note, tp.sort_order,
       tp.price, tp.reservation, tp.reservation_url
FROM trip_pois tp
JOIN pois p ON tp.poi_id = p.id
WHERE tp.trip_id = ? AND tp.entry_id = ? AND tp.context = 'timeline'
ORDER BY tp.sort_order;

-- 購物
SELECT p.*, tp.id AS trip_poi_id,
       tp.description AS tp_description, tp.note AS tp_note, tp.sort_order,
       tp.must_buy
FROM trip_pois tp
JOIN pois p ON tp.poi_id = p.id
WHERE tp.trip_id = ? AND tp.entry_id = ? AND tp.context = 'shopping'
ORDER BY tp.sort_order;
```

### 前端合併邏輯

```typescript
function mergePoi(poi: Poi, tripPoi: TripPoi): MergedPoi {
  return {
    ...poi,
    description: tripPoi.description ?? poi.description,  // NULL = 繼承 master
    note: tripPoi.note ?? poi.note,
    hours: tripPoi.hours ?? poi.hours,
  };
}
```

### Sync 機制

```typescript
// 客觀欄位 → 回寫 master
const SYNC_TO_MASTER = ['google_rating', 'hours', 'phone', 'address', 'maps', 'mapcode', 'lat', 'lng'];

// 主觀欄位 → 不回寫
const TRIP_ONLY = ['description', 'note'];
```

---

## Skill Markdown 分段規則

POI description 依資訊類型分段落（用 markdown heading）：

| POI type | 段落結構 |
|----------|---------|
| hotel | **位置與交通** / **設施與服務** / **餐食資訊** / **停車說明**（無獨立停車 POI 時）|
| attraction | **概述** / **遊玩重點** / **實用資訊**（門票/預約/注意事項）|
| restaurant | **特色與推薦** / **用餐須知** |
| shopping | **特色商品** / **營業與交通資訊** |
| parking | **位置** / **費用與規則** |

---

## 資料遷移策略

### Migration 0015

```sql
-- ⚠️ 安全：pois/trip_pois 在 migration 0014 建立但零資料，DROP 安全
DROP TABLE IF EXISTS trip_pois;  -- 先 DROP（有 FK 指向 pois）
DROP TABLE IF EXISTS pois;

-- 重建 pois（lat/lng 獨立欄位，零 JSON）
CREATE TABLE pois (...);

-- 重建 trip_pois（扁平化類型欄位，無 parent_trip_poi_id）
CREATE TABLE trip_pois (...);

-- 新增 POI 關聯表（停車場↔飯店 多對多）
CREATE TABLE poi_relations (...);
```

### migrate-pois.js 更新

```
1. D1 備份（先跑 dump-d1.js）
2. 讀取 hotels/restaurants/shopping + trip_days
3. 名稱正規化 + 去重 → INSERT pois master
   去重 key: (normalized_name, type, maps)（審查 E5）
   衝突解決: latest updated_at 贏，落選存 trip_pois 覆寫（審查 E7）
4. 建立 trip_pois 引用 + 扁平化類型欄位
5. 停車場拆分（審查 E6）:
   有 parking.name + (lat/lng 或 maps) → 獨立 pois(type=parking) + poi_relations
   無名稱或無位置 → 合入飯店 description 段落
6. 全部包 batch transaction（審查 E8）
7. 驗證 row counts: 預期 N hotels → 已遷移 M
8. 舊表 RENAME → _legacy（最後一步）
```

---

## 執行順序

```
1. D1 備份
2. Migration 0015（DROP 空表 + 重建 pois/trip_pois/poi_relations）
3. 更新 migrate-pois.js（新 schema + 扁平化 + poi_relations）
4. 跑 migrate-pois.js（填資料 + 舊表 RENAME _legacy）
5. API 重寫（2-table JOIN pois + trip_pois）
6. 新增 admin PATCH /api/pois/:id（審查 C2）
7. 前端 mergePoi.ts + mapDay.ts 更新
8. TypeScript 型別更新（Poi/TripPoi/MergedPoi）
9. 前端元件更新（Hotel/Restaurant/Shop 讀新結構）
10. mapRow JSON_FIELDS 清理（審查 E10）
11. Skills 更新（tp-edit/tp-create/tp-patch — 寫入規則 + markdown 分段）
12. seed.sql 修復
13. CLAUDE.md 更新
14. 測試（7 項 — 審查 E9）+ 全量驗證
```

> migrate-trip-docs.js 拆到獨立 PR（審查 C6）
> /api/pois 列表端點 defer（審查 C5）

---

## 影響範圍

### 新增
- `migrations/0015_poi_schema_v2.sql`
- `src/lib/mergePoi.ts`（POI 合併邏輯）
- `functions/api/pois/[id].ts`（admin PATCH — 審查 C2）

### 修改
- `scripts/migrate-pois.js`（全面重寫 — 新 schema + 扁平化 + poi_relations）
- `functions/api/trips/[id]/days/[num].ts`（2-table JOIN 查詢重寫）
- `functions/api/trips/[id]/audit/[aid]/rollback.ts`（TABLE_COLUMNS 更新）
- `src/lib/mapDay.ts`（mergePoi 取代直接映射）
- `src/lib/mapRow.ts`（JSON_FIELDS 清理 — 審查 E10）
- `src/types/trip.ts`（Poi/TripPoi/MergedPoi 型別）
- `src/pages/TripPage.tsx`（export 欄位更新）
- `src/components/trip/Hotel.tsx`（讀扁平化欄位）
- `tests/` — 7 項新測試（審查 E9）
- `CLAUDE.md`（DB schema 文件）
- `migrations/seed.sql`（修復 + 新 schema）
- Skills: tp-edit, tp-create, tp-patch, tp-rebuild

### 廢除（RENAME _legacy）
- `hotels` → `hotels_legacy`
- `restaurants` → `restaurants_legacy`
- `shopping` → `shopping_legacy`

### 不在此 PR（拆出）
- migrate-trip-docs.js（獨立 PR — 審查 C6）
- /api/pois 列表端點（defer — 審查 C5）

---

## 風險

1. **資料遷移去重**：同名但不同分店（唐吉軻德 國際通店 vs 那霸店）→ 名稱正規化需保留分店後綴
2. **JOIN 效能**：D1 對 3-table JOIN 效能未知 → migration 後立即 benchmark
3. **停車場拆分**：parking JSON 有些只有 note 無名稱 → 需判斷邏輯
4. **audit_log 歷史**：舊 diff_json 含舊欄位名 → 接受不一致
5. **D1 限制**：D1 不支援 `ALTER TABLE ADD CONSTRAINT` → extension FK 需在 CREATE 時設定

## 不做的事

- ❌ 不建 POI 搜尋/瀏覽 UI（用 API + skill 維護）
- ❌ 不做跨行程 POI 推薦
- ❌ 不遷移 audit_log 舊 diff
- ❌ 不改 trip_docs 表結構（只改 content 格式）
