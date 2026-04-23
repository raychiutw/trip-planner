# SPEC — POI Unification for Timeline Stops

**Status**: Draft
**Target**: v2.2.0.0
**Related planning**: `.claude/skills/` + `openspec/changes/poi-attraction-unification/` (後續 OpenSpec propose)
**Last updated**: 2026-04-23

## 1. Objective

統一 timeline 景點進入 `pois` master table。現狀 `pois` 只收 restaurant / shopping / hotel / parking（439 筆），景點 / 交通節點 / 體驗活動繞過 POI 直接存在 `trip_entries.location` JSON。目標：**所有 spatial entity 都是 POI master**，`trip_entries` 只保留 trip-specific 欄位（time / title / description / travel / note）。

**Target users**:
- tp-* skills — 統一 find-or-create 流程
- 未來功能 — 跨 trip POI 聚合（熱門度、重複行程統計、推薦）
- 資料品質 — spatial metadata single source of truth

**Success criteria**:
- 所有 timeline entries 有 `poi_id` FK (non-null)
- `trip_entries.{location, maps, google_rating}` 欄位移除
- 7 種 POI type 同級（restaurant / shopping / hotel / parking / attraction / transport / activity）
- R11 / R12 / R17 assertion 跑 POI master
- Phase 1/2 零 breaking changes；Phase 3 需 backup

**Non-goals**:
- POI version history / name 變更追溯
- User-curated POI reviews
- 跨 trip popularity / recommendation engine
- Merge 重複 POI（相同 name + lat/lng 50m 內但 type 不同）

## 2. Commands

```bash
# Development
npm run dev:init              # 初始化本機 SQLite 含新 migrations
npm run dev                   # vite (5173) + wrangler (8788)

# Phase 1 — schema
npx wrangler d1 migrations apply trip-planner-db --remote

# Phase 2 — 資料遷移
node scripts/migrate-entries-to-pois.js --dry-run --trip all
node scripts/migrate-entries-to-pois.js --apply --trip all

# Phase 3 — drop entry override columns（不可逆，須先 backup）
node scripts/dump-d1.js --remote trip-planner-db --out backups/
npx wrangler d1 execute trip-planner-db --remote --file migrations/0027_drop_entry_location.sql

# Verification
npm test                                        # vitest unit
npm run test:api                                # api + find-or-create
node scripts/verify-entry-poi-backfill.js --all # 確認 100% entries 有 poi_id
```

## 3. Project Structure

### New files
- `migrations/0025_extend_poi_types.sql` — 新 `activity` type（SQLite 限制下用 dual-rename swap pattern，同時 rebuild pois + trip_pois 以滿足 D1 FK constraint）✅ Phase 1 done
- `migrations/0026_trip_entries_poi_id.sql` — `ADD COLUMN poi_id INTEGER REFERENCES pois(id)` (nullable during migration) ✅ Phase 1 done
- `migrations/0027_drop_entry_location.sql` — Phase 3: DROP `trip_entries.{location, maps, google_rating}`（不可逆）
- `scripts/migrate-entries-to-pois.js` — Phase 2 find-or-create backfill（dry-run + apply）
- `scripts/verify-entry-poi-backfill.js` — Phase 2 後 coverage assertion

### Modified files
- `functions/api/trips/[id]/days/[num].ts` — PUT handler：timeline entry 走 `batchFindOrCreatePois`（既有 restaurants/shopping/hotel/parking 路徑擴充到 entry 本體）
- `functions/api/trips/[id]/days/[num]/entries.ts` — POST：find-or-create POI 後寫 `poi_id`
- `functions/api/trips/[id]/entries/[eid].ts` — PATCH：location 欄位 Phase 3 後不再接受，poi_id 可改
- `functions/api/_utils.ts` — `batchFindOrCreatePois` 支援 `attraction / transport / activity`
- `src/lib/mapDay.ts` — `toTimelineEntry`：POI JOIN 讀 lat/lng/maps/google_rating，Phase 2 後不再讀 entry 欄位
- `src/types/trip.ts` — `TimelineEntry.poi` shape + POI type enum 更新
- `.claude/skills/tp-quality-rules/SKILL.md` — R11 / R12 / R17 改檢查 POI master
- `.claude/skills/tp-create/SKILL.md` / `tp-edit/SKILL.md` / `tp-rebuild/SKILL.md` — entry 操作走 POI

## 4. Code Style

- 延用既有 `batchFindOrCreatePois` pattern（`migrations/0018` `UNIQUE(name, type)` index 保證 idempotent find-or-create）
- **POI type classification heuristic**（Phase 2 migration script）：
  - title 含「機場 / 空港 / 港 / 碼頭 / 站 / 駅 / airport / station / port」→ `transport`
  - 含 reservation / hours 且 duration > 1h（浮潛、玉泉洞、鳳梨園）→ `activity`
  - 其餘預設 → `attraction`
  - confidence < 80% → review queue，人工 decide
- 每 phase 獨立 PR + 獨立 VERSION bump + 各自走 `tp-team` 7 階段 pipeline
- Migration script 強制 `--dry-run` 後才能 `--apply`；apply 寫 `.gstack/migration-reports/{timestamp}.md`
- Phase 3 執行前強制 `dump-d1.js` backup（assertion 在 script 頂端）

## 5. Testing Strategy

### Unit
- `batchFindOrCreatePois` 新 3 type（attraction / transport / activity）測試
- `toTimelineEntry` 讀 POI JOIN（Phase 2 後）
- Phase 2 script heuristic：title → type 分類、duplicate detection（相同 `(name, type)` reuse）
- 邊界：title 空白、lat/lng NaN、maps 欄位含奇異字元

### Integration（functions/api tests）
- `PUT /days/:num` — entry 帶 maps + lat + lng → 建 POI + 寫 poi_id
- `POST /entries` — 同上
- `PATCH /entries/:eid` — 不改 POI master（POI 改走 separate endpoint）
- `GET /days/:num` — response 含 `entry.poi`（JOIN 結果）

### Migration dry-run（Phase 2 gate）
- 所有 trips（merge R19 後 ~13 trip）entries 分類
- 每類 confidence：`attraction: X%, transport: Y%, activity: Z%, uncertain: W%`
- Duplicate detection：Q4=A 跨 trip 共享，那覇空港 Day 1 + Day 7 同 `pois.id`
- Report：N entries → M new POIs + K reused POIs + J uncertain（需 admin review）

### E2E（Playwright）
- R19 check-out entry render 後 POI JOIN 仍正確
- MapPage 多天總覽 polyline 使用 `pois.lat / lng`

### 跨階段 regression
- 每 phase ship 後：`/tp-rebuild okinawa-trip-2026-HuiYun` + `/tp-check` 綠燈
- `/qa` prod smoke — R19 + map pin 正確

## 6. Boundaries

### Always do
- Phase 2 `--apply` 前強制 `--dry-run` + diff review
- Phase 3 執行前 `scripts/dump-d1.js` full backup（不可逆 DROP column）
- 每 phase 獨立 PR + 獨立 VERSION bump
- R-rules assertion 跑 POI master，不 fallback entry override

### Ask first about
- Phase 3 DROP column 執行時機 — 不可逆
- Phase 2 中 confidence < 80% 的 POI type classification
- Ambiguous cases：瀨長島（attraction 還是 transport？）、古宇利島（attraction 還是 activity？）

### Never do
- Bypass find-or-create 直接 INSERT pois（違反 `UNIQUE(name, type)` index → constraint error）
- 刪除 `pois` 未先 `DELETE FROM trip_pois` + `UPDATE trip_entries SET poi_id = NULL`
- Mix POI master 與 entry override 作為 spatial source（挑一邊，Phase 2 後全走 POI）
- Skip Phase 2 dry-run 直接 apply

### Out of scope（future work）
- POI versioning（name / maps URL 變更 history）
- User-curated POI reviews（跟 trip_pois 分離）
- 跨 trip POI popularity rankings / 推薦 engine
- Map clustering by POI type
- Merge 重複 POI（相同 name + lat/lng 50m 內但 type 不同）

### Open decisions（需 user confirm 才能進 Phase 1）
1. **Activity type 取捨**：
   - (a) 新 `activity` type（需重建 `pois` 表 — `ALTER CHECK` SQLite 限制）
   - (b) activity 類 POI 歸為 `other`（既有 CHECK 已允許，省一次 table rebuild，semantic 較不清楚）
2. **Phase 3 時機**：
   - (a) v2.2.0.0 隨 Phase 2 同個 release
   - (b) 延後到 v2.3.0.0，觀察期 2 週確認 POI master 路徑無 bug 再 DROP
3. **Phase 2 confidence gate 門檻**：uncertain 允許比例（預設 5%）— 超過就 STOP
4. **Phase 2 tombstone migration**：已刪 trip（前面 5 個被刪的 okinawa-trip-2026-RayHus 等）的 pois 是否在遷移時一併清理？

## Revision history

- 2026-04-23 初稿：以 Q1=B（3 types: attraction / transport / activity）/ Q2=A / Q3=B / Q4=A 為基礎
- 2026-04-23 Phase 1 ship：Open Decisions 解答 = 1(a) 新 `activity` type / 2(a) Phase 3 隨 v2.2.0.0 同 release / 3 ok（5% confidence 門檻）/ 4 ok（Phase 2 一併清理 orphan POI）
- 2026-04-23 Phase 1 bug fix：adversarial review 抓到 `migrations/0025` 漏 rebuild `poi_relations`（SQLite ALTER RENAME 會把全 DB 內對 pois 的 FK 重寫，單 rebuild pois + trip_pois 會留下 poi_relations → pois_old dangling FK，production insert 會 `no such table` fail）。改用 **triple-rename swap**，連 poi_relations 一起 rebuild。Rollback 同步修正。
