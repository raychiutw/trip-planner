# OSM Integration + Trip Modal v2 — 行程／POI 資料完整度補完

> **Date:** 2026-05-02 · **Owner:** Ray (lean.lean@gmail.com)
> **Status:** Plan + 12 questions resolved → 進入 Build 階段
> **Mockup:** `docs/design-sessions/trip-modal-v2-osm-fields.html`（user 已同意；實作時 mockup 中 `self_drive` toggle 拔掉，進階設定剩 4 欄）
> **PR strategy:** 單一 PR（user 拍板）

---

## Why

### 痛點 1 — 景點移動排序時相對車程未更新

調查發現 server 完全無自動算 travel：
- 前端 `TimelineRail.handleDragEnd` 只送 `sort_order`（`src/components/trip/TimelineRail.tsx:746-772`）
- batch endpoint 白名單僅 `['sort_order','day_id','time']`（`functions/api/trips/[id]/entries/batch.ts:23`）
- 沒有 server hook，唯一會算 travel 的是 `/tp-edit /tp-rebuild /tp-request` 三個 LLM skill
- → UI 直接拖曳 → `sort_order` 變但 `travel_*` 不動，TravelPill 顯示舊資料

### 痛點 2 — 直接 API 呼叫時 POI 資料欄位有缺漏

| Endpoint | 缺漏 |
|---|---|
| `POST /trips/:id/days/:n/entries` | 不接 `address/phone/website/email/category/hours` |
| `POST /trips/:id/entries/:eid/trip-pois` | 同上 |
| `PATCH /trips/:id/trip-pois/:tpid` | 白名單拒收 master 欄位，silent no-op |

### 痛點 3 — UI 建立的 trip 與 tp-create 結構落差 ~80%

- `POST /trips` 不自動建 5 種 `trip_docs`（checklist/backup/suggestions/flights/emergency）
- `NewTripModal` 不傳 `title / footer / food_prefs / self_drive / og_description / auto_scroll`
- multi-dest list 收的 lat/lng/day_quota 只在前端 state，**沒結構化存 DB**

### 痛點 4 — `trips` schema 累積 dead / over-engineered 欄位

| 欄位 | 移除原因 |
|---|---|
| `auto_scroll` | dead column — 前端完全沒讀（動態算 `trip_days.date`） |
| `og_description` | SSR fallback 已 derive `trip.countries` |
| `footer` | UI 區塊整塊拔（user 拍板） |
| `food_prefs` | tp-quality-rules R1 改通用推薦邏輯（user 拍板） |
| `is_default` | 無 DB trigger，fallback 改用「user 第一個 published=1」 |
| `self_drive` | **與 default_travel_mode 重複（Q1）**，UX 困惑；自駕 POI 顯示改吃 `default_travel_mode='driving'` |

### 痛點 5 — 依賴 Google API 的 vendor lock-in

`pois.google_rating` 綁死 Google Places API。改用 **OpenTripMap (1-7 rate)** + **OSM Overpass** + **OpenRouteService** 完全脫離 Google。

---

## What Changes

按主題拆 4 capability，**全部塞同一個 PR**（user 拍板）。

### 1. `osm-poi-enrichment` — POI 補欄位 + Google rating 替換

- 新 server lib：`src/server/osm/{nominatim,overpass,opentripmap,wikidata}.ts`
- 新 endpoint：`POST /api/pois/:id/enrich`（90 天 cache）
- pois schema：rename `google_rating → rating`，**migration 同時 UPDATE rating=NULL（Q3 清空）**，DROP `maps`，新增 6 欄 OSM 追溯
- **新 script `scripts/poi-enrich-batch.ts`（Q3 batch 重新查）** — migration 跑完跑一次，全 POI 經 OpenTripMap 拉真實 1-7 rate
- helper：`src/lib/mapsUrl.ts` 動態組 Google / Apple / Naver maps URL
- `POST entries / POST trip-pois` body 擴充收 `address/phone/website/email/category/hours`，forward 給 findOrCreatePoi
- `PATCH /trip-pois/:tpid` 偵測 master 欄位 → 自動轉派 `PATCH /pois/:id`

### 2. `travel-recompute` — 移動景點時自動算車程

- 新 server lib：`src/server/routing/ors.ts`（OpenRouteService client，2k req/day free）
- 新 server lib：`src/server/travel/compute.ts`（ORS primary + Haversine fallback）
- 新 endpoint：`POST /api/trips/:id/recompute-travel?day=N`
- 前端：`TimelineRail.handleDragEnd` 後自動 fire recompute
- `trip_entries` schema：加 `travel_distance_m / travel_computed_at / travel_source`
- batch endpoint 白名單擴充加 travel_*

### 3. `trips-schema-cleanup` — trips 表精簡 + multi-dest 正規化

- **DROP 6 欄**: `auto_scroll / og_description / footer / food_prefs / is_default / self_drive`
- **ADD 3 欄**: `data_source / default_travel_mode / lang`（**`region` 不加，改 derive from trip_destinations 子表，Q2**）
- **新 `trip_destinations` 子表（Q2）**: 正規化 multi-dest 結構
- 連帶刪 `Footer.tsx` + tp-create / tp-quality-rules 範本拔 footer/food_prefs/og_description/auto_scroll/self_drive
- TripPage 訪客 fallback 改用「user 第一個 published=1」
- `POST /trips` 自動建 5 種 `trip_docs` 空殼

### 4. `trip-modal-v2` — NewTripModal + EditTripModal 重做

對齊 mockup：`docs/design-sessions/trip-modal-v2-osm-fields.html`（實作時拔 self_drive toggle）

**保留** 現有 multi-dest list + 雙日期模式 + 偏好 textarea。

**新增 4 個欄位**（不是 5，Q1 拔 self_drive）放「進階設定」collapsible：
- `title`（選填，自動命名 from `trip_destinations[0].name`）
- `description`（選填）
- `lang`（select：zh-TW / en / ja）
- `default_travel_mode`（segment：自駕 / 步行 / 大眾運輸）

**新增** `published` 3-state segment（草稿 / 上線）放底部 actions row。

**新增** `EditTripModal`（預填 + region 變更提示）。

**multi-dest 寫入**：NewTripModal/EditTripModal POST body 含 `destinations: [{name, lat, lng, day_quota, sub_areas, osm_id}]`，server 寫入 `trip_destinations` 子表。

---

## Capabilities

### New Capabilities

- `osm-poi-enrichment` — POI enrichment contract（90 天 cache、data_source 追溯、rating 1-7）
- `travel-recompute` — entries 變動時自動算車程的 endpoint contract
- `trip-modal-v2` — NewTripModal v2 + EditTripModal v2 結構（4 進階欄位）/ 自動命名 / region 變更提示
- **`trip-destinations-table`** — 新子表正規化 multi-dest contract

### Modified Capabilities

- `trips-schema` — DROP 6 dead/重複欄位 + ADD 3 OSM/UI 欄位
- `pois-schema` — google_rating → rating（1-7）+ clear → batch enrich，DROP maps，加 6 OSM 欄
- `trip-entries-schema` — 加 travel_distance_m / travel_computed_at / travel_source
- `tp-create-skill` — 拔 footer/food_prefs/og_description/auto_scroll/self_drive 範本
- `tp-quality-rules-r1` — 餐廳推薦不再對應 3 偏好

---

## Impact

### Schema (migration `0045_osm_integration_and_trips_meta.sql`)

```sql
-- ===== trips: DROP 6 欄 (Q1 加 self_drive) =====
ALTER TABLE trips DROP COLUMN auto_scroll;
ALTER TABLE trips DROP COLUMN og_description;
ALTER TABLE trips DROP COLUMN footer;
ALTER TABLE trips DROP COLUMN food_prefs;
ALTER TABLE trips DROP COLUMN is_default;
ALTER TABLE trips DROP COLUMN self_drive;

-- ===== trips: ADD 3 欄 (region 改用 trip_destinations 子表，Q2) =====
ALTER TABLE trips ADD COLUMN data_source TEXT DEFAULT 'manual';
ALTER TABLE trips ADD COLUMN default_travel_mode TEXT DEFAULT 'driving';
ALTER TABLE trips ADD COLUMN lang TEXT DEFAULT 'zh-TW';

-- ===== 新 trip_destinations 子表 (Q2 正規化 multi-dest) =====
CREATE TABLE trip_destinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  dest_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  lat REAL,
  lng REAL,
  day_quota INTEGER,
  sub_areas TEXT,                 -- JSON array string，例 '["梅田","難波"]'
  osm_id INTEGER,
  osm_type TEXT,                  -- 'node' | 'way' | 'relation'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_trip_destinations_trip ON trip_destinations(trip_id, dest_order);

-- ===== pois: rename + clear rating + DROP maps + ADD 6 OSM 欄 (Q3) =====
ALTER TABLE pois RENAME COLUMN google_rating TO rating;
UPDATE pois SET rating = NULL WHERE rating IS NOT NULL;  -- 清空舊 1-5，等 batch enrich 補真實 1-7
ALTER TABLE pois DROP COLUMN maps;
ALTER TABLE trip_pois DROP COLUMN maps;  -- 若存在
ALTER TABLE pois ADD COLUMN osm_id INTEGER;
ALTER TABLE pois ADD COLUMN osm_type TEXT;
ALTER TABLE pois ADD COLUMN wikidata_id TEXT;
ALTER TABLE pois ADD COLUMN cuisine TEXT;
ALTER TABLE pois ADD COLUMN data_source TEXT;       -- 'opentripmap'|'osm'|'manual'|'merged'
ALTER TABLE pois ADD COLUMN data_fetched_at INTEGER;
CREATE INDEX idx_pois_osm ON pois(osm_id, osm_type);

-- ===== trip_entries: 加 travel 完整欄位 =====
ALTER TABLE trip_entries ADD COLUMN travel_distance_m INTEGER;
ALTER TABLE trip_entries ADD COLUMN travel_computed_at INTEGER;
ALTER TABLE trip_entries ADD COLUMN travel_source TEXT;  -- 'ors'|'osrm'|'haversine'|'manual'
```

### Migration 跑法 (Q6 — staging + dump backup + down script)

```bash
# 1. Build 階段先 staging 跑
npx wrangler d1 execute trip-planner-db-staging --remote --file=migrations/0045_*.sql

# 2. Prod 跑前 dump full backup
npx wrangler d1 export trip-planner-db --remote > backup-pre-0045-$(date +%Y%m%d).sql
# 把 backup 存到 ~/Library/Mobile Documents/iCloud Drive 之類安全位置

# 3. Prod migration
npx wrangler d1 execute trip-planner-db --remote --file=migrations/0045_*.sql

# 4. 立刻跑 batch enrich (Q3)
bun run scripts/poi-enrich-batch.ts
# 全 POI 過一次 OpenTripMap，UPDATE rating + osm_id + 其他欄位
# 預估時間: ~500 POI × 200ms = 100 秒

# 5. down migration (rollback) 寫好但不跑
# migrations/rollback/0045_osm_integration_and_trips_meta.down.sql
# schema 可回，dropped 欄位 data 不可回（要靠 backup dump 找）
```

### Server libs（新檔）

- `src/server/osm/nominatim.ts`
- `src/server/osm/overpass.ts`
- `src/server/osm/opentripmap.ts`
- `src/server/osm/wikidata.ts`
- `src/server/routing/ors.ts`
- `src/server/travel/compute.ts`
- `src/server/poi/enrich.ts`
- `src/lib/mapsUrl.ts`
- **`scripts/poi-enrich-batch.ts`** — 一次性 batch enrich script (Q3)，跑在 macOS 本機，用 CF REST API 改 D1

### API endpoints

| Endpoint | 改動 | 檔案 |
|---|---|---|
| `POST /api/trips` | body 加 `destinations: []` → 寫 `trip_destinations` 子表（Q2）+ 自動建 5 trip_docs | `functions/api/trips.ts` |
| `GET /api/trips/:id` | response 加 join `trip_destinations`（Q2） | `functions/api/trips/[id].ts` |
| `PATCH /api/trips/:id` | body destinations 變動 → DELETE + INSERT trip_destinations（Q2）；ALLOWED_FIELDS 反映新 3 欄、移除舊 6 欄 | `functions/api/trips/[id].ts` |
| `POST /api/trips/:id/days/:n/entries` | 收 `address/phone/website/email/category/hours` forward | `functions/api/trips/[id]/days/[num]/entries.ts` |
| `POST /api/trips/:id/entries/:eid/trip-pois` | 同上 | `functions/api/trips/[id]/entries/[eid]/trip-pois.ts` |
| `PATCH /api/trips/:id/trip-pois/:tpid` | master 欄位自動轉派 `PATCH /pois/:id` | `functions/api/trips/[id]/trip-pois/[tpid].ts` |
| `POST /api/trips/:id/entries/batch` | 白名單加 travel_* | `functions/api/trips/[id]/entries/batch.ts` |
| `POST /api/trips/:id/recompute-travel?day=N` | **新** — ORS + Haversine fallback | 新檔 |
| `POST /api/pois/:id/enrich` | **新** — idempotent + 90d cache | 新檔 |

### Frontend changes

| Component | 改動 |
|---|---|
| `src/components/trip/NewTripModal.tsx` | 對齊 mockup：加進階設定 collapsible + 4 欄位（**拔 self_drive，Q1**）+ published segment + title 自動命名 from `trip_destinations[0].name` + POST body 加 `destinations: []` |
| `src/components/trip/EditTripModal.tsx` | **新建** — 預填現有資料 + region 變更提示 |
| `src/components/trip/TimelineRail.tsx` | handleDragEnd 後 fire `recompute-travel` |
| `src/components/trip/Footer.tsx` | **整個刪除** |
| `src/pages/TripPage.tsx` | 移除 Footer 引用、移除 `auto_scroll`、移除 `self_drive` 引用、is_default fallback 改成「published=1」 |
| `src/components/shared/MapsButtonGroup.tsx` | **新建** — 3 button（Google/Apple/Naver）動態組 URL |
| `src/types/trip.ts` | type 同步 schema：拔 6 欄、加 3 欄、加 `destinations: TripDestination[]` |
| `src/lib/mapRow.ts` | 移除 footer JSON 解析 + auto_scroll + self_drive |

### Skill / scripts changes

| 檔案 | 改動 |
|---|---|
| `.claude/skills/tp-create/SKILL.md` | 拔 footer / food_prefs / og_description / auto_scroll / self_drive 範本；加 destinations array 格式 |
| `.claude/skills/tp-quality-rules/SKILL.md` | R1 改寫：餐廳推薦不再對應 3 食物偏好 |
| `.claude/skills/tp-shared/references/doc-spec.md` | 同步 schema 變動 |
| `scripts/seed.sql` | 移除 dropped 欄位的 INSERT，加 trip_destinations seed |
| `scripts/tp-check.js` | 移除 footer 檢查 |
| **`scripts/poi-enrich-batch.ts`** | **新** — 一次性 batch enrich (Q3) |
| `scripts/daily-report.js` | **不動** — published 保留（Q4） |

---

## Mockup Reference

✅ User-approved: `docs/design-sessions/trip-modal-v2-osm-fields.html`

包含 4 frame：
1. NewTripModal default state · 進階收起
2. NewTripModal 進階展開 · title preview · published 切上線
3. EditTripModal 預填 · region 變更提示
4. Compact 375px mobile

**實作時偏離 mockup 的點**（Q1 後）：
- 拔 mockup 中的 `self_drive` toggle，進階設定剩 4 欄
- title 自動命名邏輯改 from `trip_destinations[0].name` 而非 join string

---

## PR Strategy

**單一 PR**（user 拍板）。

### Commit 順序

1. `feat(schema): 0045 migration — drop 6 cols, add trip_destinations table, rename google_rating, drop maps, clear rating`
2. `feat(server/osm): nominatim + overpass + opentripmap + wikidata clients`
3. `feat(server/routing): ors + travel/compute + Haversine fallback`
4. `feat(server/poi): enrich orchestrator with 90d cache`
5. `feat(scripts): poi-enrich-batch.ts (run-once)`
6. `feat(api): POST /pois/:id/enrich + POST /trips/:id/recompute-travel`
7. `feat(api): POST /trips body destinations array → trip_destinations write`
8. `feat(api): GET /trips/:id include trip_destinations join`
9. `feat(api): expand POST /trips body + auto-create 5 trip_docs stubs`
10. `feat(api): expand POST entries / POST trip-pois body for OSM forward`
11. `fix(api): PATCH /trip-pois auto-dispatch master fields`
12. `fix(api): batch endpoint whitelist add travel_*`
13. `feat(lib): mapsUrl helper + MapsButtonGroup component`
14. `feat(modal): NewTripModal v2 — 進階設定 collapsible + 4 欄位 + auto-name from destinations`
15. `feat(modal): EditTripModal v2 — 預填 + region 變更提示`
16. `feat(trip): TimelineRail.handleDragEnd → recompute-travel hook`
17. `chore(cleanup): delete Footer.tsx + remove auto_scroll/footer/self_drive references`
18. `fix(trip): TripPage fallback — is_default → published=1 first match`
19. `chore(skill): tp-create + tp-quality-rules R1 — remove 拔除欄位 templates`
20. `chore(scripts): seed.sql + tp-check.js sync`
21. `docs: update CLAUDE.md / DESIGN.md decisions log`

---

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-02 | OSM rating = OpenTripMap (1-7) | 完全脫離 Google Places API；免費 5k req/day 遠超需求 |
| 2026-05-02 | `google_rating` rename → `rating` | 命名脫離 vendor |
| 2026-05-02 | 單一 PR | atomicity 優先於 review 顆粒度 |
| 2026-05-02 | 90 天 refresh `data_fetched_at + 90d` | 平衡 OSM 資料新鮮度與 API 額度 |
| 2026-05-02 | title 自動命名 from `trip_destinations[0].name` | 1: `2026 沖繩` / 2: `2026 沖繩・大阪` / 3+: `2026 沖繩等 N 地`；user 自填後不覆蓋 |
| 2026-05-02 | 進階設定 collapsible 預設摺疊 | 避免主畫面爆量 |
| 2026-05-02 | published 放底部 actions row | 強調「user 必須選一個發布狀態」 |
| 2026-05-02 | drop 6 trips 欄位 | dead column / 過度設計 / UX 重複 |
| 2026-05-02 | TripPage `is_default` fallback → `published=1` | is_default 拔除後新訪客 fallback |
| 2026-05-02 | drop pois.maps + helper 動態組 | URL 不該存 DB |
| 2026-05-02 | ORS routing primary、Haversine fallback | workerd 友善；2k/day 夠 |
| 2026-05-02 | EditTripModal 共用 NewTripModal layout | 99% 結構相同 |
| **2026-05-02** | **Q1: 拔 `self_drive`** | 與 default_travel_mode 重複；自駕 POI 顯示改吃 default_travel_mode='driving' |
| **2026-05-02** | **Q2: 加 `trip_destinations` 子表** | 正規化 multi-dest（lat/lng/day_quota/sub_areas/osm_id）；trips.region 不存 |
| **2026-05-02** | **Q3: rating clear + batch enrich** | google rating 1-5 跟 OpenTripMap 1-7 語意不同，不換算；migration 後跑 `poi-enrich-batch.ts` 一次補完 |
| **2026-05-02** | **Q4: published 保留** | daily-report.js 不動 |
| **2026-05-02** | **Q5: 不 regenerate ORS/OpenTripMap key** | user 接受 chat 暴露風險 |
| **2026-05-02** | **Q6: staging + dump backup + down script** | destructive migration 必須有 backup |

---

## Resolved Questions（12 questions answered 2026-05-02）

| # | 問題 | 答 | 實作影響 |
|---|---|---|---|
| 1 | self_drive vs travel_mode 重複 | A — 拔 self_drive | DROP COLUMN; mockup toggle 實作時拔；POI 顯示改吃 default_travel_mode |
| 2 | trip_destinations 子表 | B — 加子表 | 新 CREATE TABLE; trips.region 不加；POST/PATCH /trips body destinations array |
| 3 | google_rating 遷移 | C — clear + batch enrich | UPDATE rating=NULL；跑 poi-enrich-batch.ts 全 POI 拉真實 OpenTripMap rate |
| 4 | published 保留？ | Y | daily-report.js 不動 |
| 5 | regenerate API key | C — 不換 | 使用 .dev.vars 既有 ORS + OpenTripMap key |
| 6 | migration rollback | A | staging 試跑 + prod 前 wrangler d1 export 備份 + 寫 0045.down.sql |

---

## Build Phase 入口

```bash
git checkout -b feat/osm-integration-trip-modal-v2
# 走 /tp-team pipeline:
# Build → /simplify → /tp-code-verify → /review → /cso --diff → /qa → /ship → /land-and-deploy → /canary
```
