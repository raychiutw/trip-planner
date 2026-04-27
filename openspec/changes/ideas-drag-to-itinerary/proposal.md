## Status

> ⏸ **Deferred to V2**（2026-04-25 retro 決定）
>
> B-P5 在 SaaS pivot roadmap 中被識別為「Ideas drag UX」，但前提依賴 Ideas tab 真實 UI（目前還是 placeholder，B-P4 只做 Explore + saved pool）。先做 Ideas tab real UI，再做 drag。
>
> **不 archive 此 change** — 留 active 等 V2 排程進來時拿來用。Schema 已 ship（`trip_entries.order_in_day` + `trip_ideas.promoted_to_entry_id` from B-P1）。
>
> 相關：`docs/2026-04-25-session-retro.md` / `docs/2026-04-24-saas-pivot-roadmap.md`。

## Why

Mindtrip layout benchmark (Image 12) 顯示 Ideas ↔ Itinerary 雙向 drag 是 Ideas 分層的完整 UX。僅做「點按鈕 promote」是 text-based 操作，使用者對 Ideas 的觸感式規劃需求沒滿足。Phase 1 schema 已準備 (`trip_entries.order_in_day` + `trip_ideas.promoted_to_entry_id`)，Phase 3 Ideas tab UI 已存；此 Phase 把兩者用 dnd-kit 串成完整 drag experience。

## What Changes

- **安裝 `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/modifiers`** npm dependency
- **實作 4 種 drag action**:
  1. **Promote**: Ideas card 拖到 Day N 時段 → 新增 trip_entry + 更新 idea.promoted_to_entry_id
  2. **Reorder within Day**: entry 拖動同 Day 其他位置 → 更新 start_time + order_in_day
  3. **Cross-Day move**: entry 拖到另一 Day → 更新 day_id + start_time + order_in_day
  4. **Demote**: entry 拖回 Ideas → 清 day_id/start_time，保留 poi_id，回到 Ideas
- **UX 加強**：
  - Long-press 100-200ms 啟 drag（避免誤觸）
  - Drag hover drop zone → highlight border + bg tint
  - 衝突 modal：drop 時段與既有 entry 重疊 → 彈「換位置 / 併排」選項
  - Undo toast：每次 drag 結束 5 秒內可 revert
  - Smart placement：無時段 drop 時 default 該 Day 最後 entry 後 1 小時

## Capabilities

### New Capabilities

- `drag-to-promote`: Ideas card → Itinerary Day slot 的 drag-to-promote pattern，含衝突處理與 undo
- `drag-to-reorder`: Itinerary 內 entry 拖動重排（同 Day + cross-Day），更新 order_in_day 與 day_id，含衝突處理

### Modified Capabilities

- `trip-sheet-state`: Ideas tab 原 Phase 3 的「排入行程」text button 保留但加 drag 能力；原 spec 加 ADDED Scenarios 描述 drag 流程

## Impact

- **新 files**：
  - `src/components/trip/DraggableIdeaCard.tsx`
  - `src/components/trip/DroppableDayZone.tsx`
  - `src/components/trip/DraggableEntry.tsx`
  - `src/hooks/useDragDrop.ts`（dnd-kit context + sensors）
  - `src/lib/drag-strategy.ts`（smart placement 演算法）
  - `src/components/trip/ConflictModal.tsx`
- **修改 files**：
  - `src/components/trip/IdeasTabContent.tsx` (Phase 3) + `ItineraryTabContent.tsx` → 包 dnd-kit context，支援 draggable
  - `functions/api/trip-entries.ts`（既有）+ `trip-ideas.ts` (Phase 1) 加 batch update endpoints 加速 drag final commit
- **測試**：unit test for drag handlers + Playwright E2E for 4 種 drag scenarios
- **依賴**：`@dnd-kit/core ^6.x` + `@dnd-kit/sortable ^8.x` + `@dnd-kit/modifiers ^7.x`
- **Breaking**：無（drag 是附加功能，既有 text button 保留為 a11y fallback）
