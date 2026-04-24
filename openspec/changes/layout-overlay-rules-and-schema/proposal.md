## Why

Mindtrip Layout benchmark 完成後，trip-planner 未來 12 週 layout refactor（3-pane / 5 nav / 探索 / Ideas / drag）全部依賴兩件底層基礎：
1. **Schema 層**：`saved_pois`（探索儲存池）+ `trip_ideas`（per-trip maybe list）+ `trip_entries.order_in_day`（drag reorder 必要欄位）
2. **Design system 層**：DESIGN.md 缺 Overlay Pattern Rules，每次新 modal/sheet 都是猜 — 必須 codify 避免未來 pattern drift

此 Phase 是 Phase 2-6 的 blocker。先補 schema + DESIGN.md，後面才能 build UI。

## What Changes

- **新增 migration 0028**：`saved_pois(id, user_id, poi_id, saved_at, note)` — 使用者跨 trip 的 POI 收藏池
- **新增 migration 0029**：`trip_ideas(id, trip_id, poi_id, title, note, added_at, added_by, promoted_to_entry_id, archived_at)` — per-trip 的 maybe list
- **新增 migration 0030**：`ALTER TABLE trip_entries ADD COLUMN order_in_day INTEGER NOT NULL DEFAULT 0` — 為 Phase 5 drag reorder 準備
- **新增 API endpoints**：
  - `GET/POST/DELETE /api/saved-pois`
  - `GET/POST/DELETE /api/trip-ideas?tripId=...`
- **修改 DESIGN.md**：新增 `## Overlay Pattern Rules` section（modal / bottom sheet / full-screen cover 決策樹 + 對照表 + anti-patterns）
- 不改任何既有 UI component（此 Phase 純 backend + design doc）

## Capabilities

### New Capabilities

- `saved-pois-schema`: 使用者跨 trip 的 POI 儲存池（收藏用途），含 CRUD API 與 FK 到既有 pois table
- `trip-ideas-schema`: per-trip 的 maybe list，與 trip_entries 分離，支援 promote 到 itinerary 的 state machine
- `design-system-overlay-rules`: DESIGN.md 新增 overlay pattern canonical rules，作為後續所有 modal / sheet / cover 的依據

### Modified Capabilities

（無 — 此 Phase 純新增，不動既有行為）

## Impact

- **程式碼**：
  - `migrations/0028_saved_pois.sql`
  - `migrations/0029_trip_ideas.sql`
  - `migrations/0030_trip_entries_order_in_day.sql`
  - `migrations/rollback/0028-0030_*.sql`
  - `functions/api/saved-pois.ts`
  - `functions/api/saved-pois/[id].ts`
  - `functions/api/trip-ideas.ts`
  - `functions/api/trip-ideas/[id].ts`
  - `src/types/api.ts`（新增 SavedPoi / TripIdea interface）
- **文件**：`DESIGN.md` 新增 Overlay Pattern Rules section
- **測試**：對應 API integration tests + migration rollback test
- **依賴**：無新套件
- **部署**：migrations 在 Week 1 staging 先跑，確認無 data loss，再 prod
