## Context

trip-planner 要 Mindtrip 化（參 `~/.gstack/projects/trip-planner/lean-master-design-20260424-190000-mindtrip-layout-reference.md`），6 個 Phase 的 layout refactor 計畫中，Phase 1 是底層基礎：

- **saved_pois**：對齊 sidebar「探索」nav 的儲存池需求（Q5 locked）
- **trip_ideas**：對齊 Mindtrip 的 Ideas vs Itinerary 分層（比 Mindtrip benchmark doc Approach B 同）
- **trip_entries.order_in_day**：drag reorder 的底層欄位（Phase 5 用）
- **DESIGN.md Overlay Rules**：Phase 2-6 所有新 modal / sheet / cover 的依據（Q6 locked）

既有 schema：`pois`（AI 維護 master）+ `trip_pois`（user 覆寫）+ `trip_entries`（時間軸 entry）。新增的 2 table 都靠 FK 連 `pois`，不重複儲存 POI 內容。

## Goals / Non-Goals

**Goals:**
- 新增 3 個 migration（非破壞性，全 ADD，無 ALTER existing column）
- 新增 4 個 API endpoints（saved-pois CRUD + trip-ideas CRUD）
- DESIGN.md 擴充 overlay section，為 Phase 2-6 PR reviewer 提供 canonical 依據
- 所有 API 遵循既有 error handling pattern（`AppError` + `ErrorCode` enum）

**Non-Goals:**
- 不做任何 UI 改動（Phase 2+ 才動 UI）
- 不做 POI 搜尋整合（Phase 4 才做）
- 不改 `trip_entries` 既有欄位語意（`order_in_day` 只是新增 default=0，不影響現有 entry）
- 不做 drag-and-drop 邏輯（Phase 5）
- 不動 auth 架構（`saved_pois.user_id` 暫時用 email 當 FK until V2 OAuth ship）

## Decisions

### 1. `saved_pois` 以 email 當 owner（而非 user_id）
**為何**：V2 OAuth plan 尚未 ship（users table 還沒建），現有所有 identity 都是 email-based（`trip_permissions.email`, audit_log.changed_by 等）。用 email 當 owner 對齊現有 pattern，未來 V2 OAuth ship 時 migration 成 user_id FK（類 `trip_permissions` 的 backfill 策略）。
**備選**：用 user_id FK blocked on V2 OAuth → 會把 Phase 1 卡住 1-2 個月。拒絕。

### 2. `trip_ideas` 綁 trip_id（per-trip），不是 cross-trip
**為何**：Ideas 是 per-trip maybe list（Mindtrip pattern）。使用者 UX 期望是「這個 trip 有哪些我想去但還沒排時間的 POI」，不是全局收藏。全局收藏是 `saved_pois`。
**備選**：合併成單一 table 用 `scope` 欄位區分 — 複雜度高且 query 需 filter，拒絕。

### 3. `trip_entries.order_in_day` default 0 + 現有 entry 全 0
**為何**：現有 entry 靠 `start_time` 排序，新 `order_in_day` 是 tie-breaker（同時段多 entry）+ 為 Phase 5 drag reorder 提供穩定 sort key。default 0 + 非 NOT NULL exception 避免 backfill migration 風險。
**備選**：migration 時 backfill 成連號（`ROW_NUMBER() OVER (PARTITION BY day_id ORDER BY start_time)`）— 增加 migration 複雜度，Phase 5 實作時再做較穩。

### 4. DESIGN.md 的 Overlay Rules 直接 merge（不透過 `/design-consultation update`）
**為何**：office-hours session 已產出 canonical content 在 `~/.gstack/projects/trip-planner/lean-master-design-20260424-190000-mindtrip-layout-reference.md` 的 Appendix，內容已 user confirmed（Q6 locked）。**但**：trip-planner 專案 rule 要求 design system 變更走 `/design-consultation update`，此 Phase 的 tasks 會 explicit 用 `/design-consultation update` merge，不在 tasks.md 外直接改 DESIGN.md。

### 5. API 路徑 plural
**為何**：RESTful 慣例 — `/api/saved-pois` / `/api/trip-ideas`。既有 API pattern 同：`/api/trip-pois/[id]`、`/api/trips/[id]`。
**備選**：`/api/save` / `/api/idea` 單數 — 不一致，拒絕。

## Risks / Trade-offs

- **[Risk] `saved_pois.poi_id` FK 若 POI 被 delete 造成 orphan** → Mitigation: `ON DELETE CASCADE` 自動清，無需應用層 sweep
- **[Risk] `trip_ideas.promoted_to_entry_id` 若 entry 被 delete 造成 dangling promote marker** → Mitigation: `ON DELETE SET NULL` 保留 idea 原 row（idea 仍存在，只是失去已 promote 紀錄）
- **[Risk] email-based owner 在 V2 OAuth migration 時需要 backfill** → Mitigation: V2 OAuth plan 已 document backfill pattern（類 `trip_permissions.user_id`），非此 Phase 問題
- **[Risk] DESIGN.md 未走 `/design-consultation update` 直接 merge 違反專案 rule** → Mitigation: tasks.md explicit 走 `/design-consultation update` flow，不直接 edit DESIGN.md
- **[Trade-off] `order_in_day` default 0 會讓所有 Phase 5 前新建 entry 都 order=0** → Phase 5 實作時一次性 backfill（ROW_NUMBER() + UPDATE）即可，非此 Phase 問題

## Migration Plan

1. **Week 1 Day 1-2**：staging 跑 migrations 0028-0030，驗證 rollback SQL 成功回復
2. **Week 1 Day 3-4**：staging 跑 API integration tests（saved-pois / trip-ideas CRUD）
3. **Week 1 Day 5**：走 `/design-consultation update` merge Overlay Rules 到 DESIGN.md
4. **Week 2 Day 1**：合進 prod，migrations 套用到 prod D1
5. **Rollback plan**：若 prod migration 失敗 → 跑 rollback SQL → 恢復到 v2.2.0.0 state；API endpoints 沒 UI 引用，不會有 user-facing 影響

## Open Questions

- Phase 1 跟 V2 OAuth plan 會不會 schema conflict？建議 Phase 1 先 ship（email owner），V2 OAuth ship 後再加 user_id FK + backfill
- DESIGN.md 的 Overlay Rules section 位置？建議放在現有 Components section 之後，獨立 `## Overlay Patterns` heading
- `trip_ideas` 是否需要 `order` 欄位（使用者排 ideas 優先順序）？建議先不加，使用者回饋後再 iterate
