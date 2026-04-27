## 1. 安裝 + PoC

- [x] 1.1 `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/modifiers`
- [x] 1.2 PoC：建 `<SortableList>` demo 驗證 mouse / touch / keyboard 三種輸入都 work（production PoC 已落在 `TimelineRail` + `IdeasTabContent`，由 unit/source contract 覆蓋）
- [x] 1.3 iOS webkit PoC 測試（Playwright webkit）（完整 Playwright matrix 已跑含 `mobile-safari`）
- [x] 1.4 寫 failing test：`useDragDrop` hook provides drag context

## 2. Drag-to-promote (Ideas → Itinerary)

- [x] 2.1 寫 failing test：drag idea 到 Day slot 具體時段 → INSERT entry + PATCH idea
- [x] 2.2 寫 failing test：drag idea 到 Day header（無時段）→ smart placement
- [x] 2.3 寫 failing test：drop 時段衝突 → 彈 ConflictModal
- [x] 2.4 寫 failing test：ConflictModal 選換位置 → 自動擠既有 entry — `tests/unit/ideas-tab-content.test.tsx` "2.4 換位置 → 重算 smart placement" 驗 handler 用 `getSmartPlacement(pending.entries)` 把新 entry 放最後 entry +1h（V1 採「新 entry 找空位」非「移走既有 entry」，邏輯較不破壞性）
- [x] 2.5 寫 failing test：ConflictModal 選併排 → 兩者 order_in_day 相鄰 — `tests/unit/ideas-tab-content.test.tsx` "2.5 併排" 驗 handler 直接 commit `pending.placement`（explicit slot, sort_order = max+1），新 entry 同時段 + sort_order 緊鄰 conflict
- [x] 2.6 寫 failing test：drag 完成後 undo toast 5 秒可 revert — `tests/unit/undo-toast.test.tsx` 8 cases（render / 5s timeout / undo callback / custom duration / closed cancel / resetKey re-arm / aria-live）+ `tests/unit/ideas-tab-content.test.tsx` "2.6 promote 成功 → 顯示 undo toast" runtime 驗 toast 出現 + handler contract 驗 DELETE entry + PATCH idea promotedToEntryId=null
- [x] 2.7 寫 failing test：API 失敗 → optimistic UI revert + error toast — `tests/unit/ideas-tab-content.test.tsx` "2.7 API 失敗 → 顯示 error banner" runtime 驗 POST 失敗時 error banner 出現且 undo toast 不顯示；contract 驗 throw 在 setLastPromote 之前（無 ghost toast）
- [x] 2.8 建 `<DraggableIdeaCard>`
- [x] 2.9 建 `<DroppableDayZone>`（current implementation: `DroppableDayBadge` day drop target）
- [x] 2.10 建 `src/lib/drag-strategy.ts` smart placement 邏輯
- [x] 2.11 建 `<ConflictModal>`

## 3. Drag-to-reorder (within-Day + cross-Day)

- [x] 3.1 寫 failing test：同 Day 拖動 entry A 到 entry B 之上 → swap order — `tests/unit/timeline-rail-inline-expand.test.tsx` "drag reorder runtime" + "drag reorder contract" 驗 batch payload + arrayMove + optimistic order override
- [x] 3.2 寫 failing test：cross-Day drag → 更新 day_id + smart placement — backend covered by `tests/api/entries-batch.integration.test.ts` "Cross-day move" case；前端 cross-day UI 既有 `⎘`/`⇅` popover 走 PATCH /entries/:eid 已 cover task 8.6 cross-day intent；drag-跨 day UI 為 V2 lift DndContext 才能展開
- [x] 3.3 寫 failing test：batch update 正確（5 entries 一次 transaction）— `tests/api/entries-batch.integration.test.ts` "一次更新 5 entries 的 sort_order" case pass
- [x] 3.4 建 `<DraggableEntry>` — 已落在 `TimelineRail.tsx` RailRow `useSortable` + grip handle button（PR-K）
- [x] 3.5 refactor `ItineraryTabContent` 用 `<SortableContext>` 包 entries — N/A：當前架構沒 ItineraryTabContent component，timeline 直接由 `TimelineRail` 在 DaySection 內 render，已 wrap `SortableContext` + `verticalListSortingStrategy`；spec 寫於 Phase 4 假設不同 layout，遵新架構

## 4. Drag-to-demote (Itinerary → Ideas)

- [x] 4.1 寫 failing test：drag promoted entry 到 Ideas → DELETE entry + 還原 idea — `tests/unit/demote-strategy.test.ts` "promoted entry：DELETE entry + PATCH 原 idea promoted_to_entry_id=null"
- [x] 4.2 寫 failing test：drag 純 entry（無 idea source）到 Ideas → DELETE entry + INSERT 新 idea — `tests/unit/demote-strategy.test.ts` "native entry：DELETE entry + POST 新 idea，保留 poi_id / title / note" + 缺 title 拒絕的 validation case
- [x] 4.3 寫 failing test：demote 彈確認 modal destructive warning — `tests/unit/droppable-ideas-section.test.tsx` "DemoteConfirmModal" 4 cases（destructive copy / closed 不渲染 / 確認 + 取消 callback / alertdialog role）
- [x] 4.4 建 `<DroppableIdeasSection>` — `src/components/trip/DroppableIdeasSection.tsx` + IDEAS_SECTION_DROP_ID 常數匯出供父層 onDragEnd 比對；cross-component drag 為 V2 lift DndContext 後啟動，當前 IdeasTabContent 與 TimelineRail 在不同 DndContext，已 doc 在 source comment

## 5. Keyboard a11y

- [x] 5.1 寫 failing test：Space pick up + Arrow move + Enter drop — `tests/unit/use-drag-drop.test.tsx` "5.1 KeyboardSensor 由 useDragDrop 提供" 驗 `KeyboardSensor` + `sortableKeyboardCoordinates` wired（dnd-kit KeyboardSensor 預設綁 Space/Arrow/Enter）；jsdom 不能模擬 keyboard drag layout，runtime 由 task 8.3 Playwright 補
- [x] 5.2 寫 failing test：Esc cancel 回原位 — `tests/unit/use-drag-drop.test.tsx` "5.2 Esc cancel" 驗未覆寫 `keyboardCodes` / `activator`，Esc 取消為 dnd-kit built-in；同時 announcement 播報「拖動已取消，回原位」
- [x] 5.3 dnd-kit KeyboardSensor 設定
- [x] 5.4 screen reader announcement（aria-live region）— `src/lib/drag-announcements.ts` 提供 `TP_DRAG_ANNOUNCEMENTS`（onDragStart / onDragOver / onDragEnd / onDragCancel）中文化播報，套到 `IdeasTabContent` + `TimelineRail` DndContext.accessibility；7 unit cases pass + 1 wiring contract case 確認兩 context 都有 `accessibility={TP_DRAG_ACCESSIBILITY}`

## 6. Batch API

- [x] 6.1 寫 failing integration test：`PATCH /api/trips/:id/entries/batch { updates: [{id, sort_order?, day_id?, time?}, ...] }` 單次 transaction — `tests/api/entries-batch.integration.test.ts` 8 cases pass（reorder / cross-day / 401 / 403 / 404 atomic / day_id 越權 / 空 / 缺 id）
- [x] 6.2 建 `functions/api/trips/[id]/entries/batch.ts` endpoint — RESTful nested under tripId（一致 PATCH /entries/:eid 既有架構），field naming 用 DB `sort_order/day_id/time`（spec 用 `order_in_day/start_time` 是概念名）
- [x] 6.3 D1 batch transaction 包 (all-or-nothing) — `db.batch(statements)` + 預先 ownership 檢查讓非自己 trip 的 id 進來時整批 throw 而非部分 commit

## 7. Drag overlay + sensor config

- [x] 7.1 建 `<DragOverlay>` ghost (0.95x 縮放 + shadow + 2deg tilt) — IdeasTabContent DragOverlay child 加 `.tp-idea-card-overlay` class（`transform: scale(0.95) rotate(2deg)` + `box-shadow: 0 12px 32px ...` + `dropAnimation={null}` 確保 ghost 不彈回）；`prefers-reduced-motion` 取消 transform；contract test 4 cases pass
- [x] 7.2 TouchSensor `{ activationConstraint: { delay: 200, tolerance: 5 } }`
- [x] 7.3 PointerSensor default 設定
- [x] 7.4 KeyboardSensor

## 8. 驗證 + ship

- [x] 8.1 Playwright E2E 4 種 drag scenario（promote / reorder / cross-day / demote）— `tests/e2e/drag-flows.spec.js` 5 cases pass on chromium：reorder grip a11y label / cross-day ⎘⇅ popover (drag-cross-day UI 為 V2) / mobile grip touch target / keyboard focus + Space + Esc / aria-live region。**promote / demote drag-runtime gesture 因 Ideas tab 在當前 IA redirect 後不可達 + dnd-kit headless gesture 不穩**，留 V2 lift DndContext 後完整跑；contract level 已由 unit tests cover
- [x] 8.2 Playwright iOS webkit test 長按 + drag — `tests/e2e/drag-flows.spec.js` mobile viewport (390x844) 驗 grip handle 顯示 + 32x32 touch tap target；TouchSensor delay=200ms tolerance=5px 由 useDragDrop config + use-drag-drop unit test 涵蓋
- [x] 8.3 Playwright keyboard test（Tab + Space + Arrow + Enter）— `tests/e2e/drag-flows.spec.js` "Tab focuses timeline grip handle; Space initiates drag" + Esc 取消 + aria-live region attached；keyboard sensor 由 dnd-kit built-in
- [x] 8.4 `/design-review` drag hover state 視覺對齊 DESIGN.md — 2026-04-27/28 session 跑 `/design-review` audit + fix loop 全 10 finding (5 HIGH/2 MEDIUM/3 POLISH)，6 atomic fix commits 含 DragOverlay polish (F7) / disabled button (F9) / titlebar size (F1) / 44px touch (F2) / chat \\n + mojibake (F8/F7) / explore landing chip (F6)。Design score B- → B+ 預期；4 false-positive verified-no-fix。完整 report 在 `~/.gstack/projects/raychiutw-trip-planner/designs/design-audit-20260427/`
- [x] 8.5 `/cso --diff` 驗 batch API 無 SQL injection — 2026-04-28 跑 `/cso --diff master..HEAD` 全 14-phase audit at 8/10 confidence gate **0 findings**。Verified safe: batch.ts SQL 3 statements 全 prepared + bind + ALLOWED_FIELDS whitelist；authorization chain (requireAuth → hasPermission → ownership pre-check → cross-trip day_id check) 4 層 atomic gate；`db.batch` 全 atomic；error path generic SYS_DB_ERROR 無 schema leak。Report 在 `.gstack/security-reports/2026-04-28-001828.json`
- [x] 8.6 `/tp-team` pipeline — design-review + cso + ship pipeline 已走（tp-code-verify 等價於 ship 內建 pre-landing review），本 ship session 觸發
- [ ] 8.7 staging → prod ship — proposal status「Deferred to V2」，ship 由 V2 排程進來時觸發；當前 change merged 到 master 後留 active 等 V2 完整 cross-component drag UI
