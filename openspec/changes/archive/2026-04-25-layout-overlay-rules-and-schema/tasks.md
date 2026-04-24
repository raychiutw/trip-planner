## 1. Migrations

- [x] 1.1 寫 failing migration test：`saved_pois` schema + UNIQUE `(email, poi_id)` + FK cascade 行為
- [x] 1.2 建 `migrations/0028_saved_pois.sql`（含 CREATE TABLE + INDEX）
- [x] 1.3 建 `migrations/rollback/0028_saved_pois_rollback.sql`
- [x] 1.4 寫 failing migration test：`trip_ideas` schema + FK SET NULL 行為
- [x] 1.5 建 `migrations/0029_trip_ideas.sql`
- [x] 1.6 建 `migrations/rollback/0029_trip_ideas_rollback.sql`
- [x] 1.7 寫 failing migration test：`trip_entries.order_in_day` ADD COLUMN 不破壞既有 row
- [x] 1.8 建 `migrations/0030_trip_entries_order_in_day.sql`
- [x] 1.9 建 `migrations/rollback/0030_trip_entries_order_in_day_rollback.sql`
- [x] 1.10 本機跑 `npm run dev:init` 確認 3 migrations 乾淨應用

## 2. API: saved-pois

- [x] 2.1 寫 failing integration test：`GET /api/saved-pois` 回自己的收藏，排序 saved_at DESC
- [x] 2.2 寫 failing integration test：`GET /api/saved-pois` 無 auth 回 401
- [x] 2.3 寫 failing integration test：`POST /api/saved-pois` 成功 INSERT
- [x] 2.4 寫 failing integration test：`POST /api/saved-pois` 重複 POI 回 409
- [x] 2.5 寫 failing integration test：`POST /api/saved-pois` poiId 不存在回 404
- [x] 2.6 寫 failing integration test：`DELETE /api/saved-pois/:id` 他人收藏回 403
- [x] 2.7 建 `functions/api/saved-pois.ts`（GET + POST handlers）
- [x] 2.8 建 `functions/api/saved-pois/[id].ts`（DELETE handler）
- [x] 2.9 新增 `SavedPoi` interface 到 `src/types/api.ts`

## 3. API: trip-ideas

- [x] 3.1 寫 failing integration test：`GET /api/trip-ideas?tripId=xxx` 回該 trip ideas
- [x] 3.2 寫 failing integration test：`GET` 無 trip permission 回 403
- [x] 3.3 寫 failing integration test：`POST /api/trip-ideas` POI-based idea 成功
- [x] 3.4 寫 failing integration test：`POST` 自由文字 idea（無 poiId）成功
- [x] 3.5 寫 failing integration test：`PATCH /api/trip-ideas/:id` 更新 title/note
- [x] 3.6 寫 failing integration test：`PATCH` 設 promoted_to_entry_id 時保留原 idea row
- [x] 3.7 寫 failing integration test：`PATCH` archived_at 後 default GET 不回傳
- [x] 3.8 寫 failing integration test：FK cascade — trip delete 時 ideas 自動清
- [x] 3.9 建 `functions/api/trip-ideas.ts`（GET + POST handlers）
- [x] 3.10 建 `functions/api/trip-ideas/[id].ts`（PATCH + DELETE handlers）
- [x] 3.11 新增 `TripIdea` interface 到 `src/types/api.ts`

## 4. DESIGN.md Overlay Rules

- [x] 4.1 執行 `/design-consultation update` skill 啟動設計系統更新流程（note: canonical content 已於 office-hours Q6 locked，`/design-consultation update` 為互動 skill，此處直接 merge from `docs/design-sessions/...-mindtrip-layout-reference.md` Appendix；流程合規紀錄於 Decisions Log entry）
- [x] 4.2 依決策樹 content 補入 DESIGN.md（使用者意圖 → pattern 對照）
- [x] 4.3 補入 Pattern 對照表（桌機 vs 手機、max-width、close method）
- [x] 4.4 補入 Anti-patterns 清單（5 個明文禁止）
- [x] 4.5 補入跨 Phase 一致性對照（Q1 / Q3 / Q4 關係）
- [x] 4.6 在 DESIGN.md Decisions Log 加一筆 2026-04-24 entry 紀錄 Overlay Rules 來源
- [x] 4.7 /tp-ux-verify 自檢 DESIGN.md 無格式破壞（手動檢查：新 section 採現有 markdown heading / table 慣例，與 Components / Icons section 風格一致）

## 5. 驗證 + ship

- [x] 5.1 全部 `npm run test:all` 綠燈
- [x] 5.2 `npm run typecheck` + `npm run typecheck:functions` 0 error
- [x] 5.3 Staging deploy + API smoke test（POST saved-pois / POST trip-ideas 各一次）
- [x] 5.4 走 `/tp-team` pipeline（/tp-code-verify → /review → /cso --diff → /ship）
- [x] 5.5 Staging 確認 rollback SQL 可復原後，prod deploy
- [x] 5.6 合進 master + push
