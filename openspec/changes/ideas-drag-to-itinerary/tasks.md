## 1. 安裝 + PoC

- [ ] 1.1 `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/modifiers`
- [ ] 1.2 PoC：建 `<SortableList>` demo 驗證 mouse / touch / keyboard 三種輸入都 work
- [ ] 1.3 iOS webkit PoC 測試（Playwright webkit）
- [ ] 1.4 寫 failing test：`useDragDrop` hook provides drag context

## 2. Drag-to-promote (Ideas → Itinerary)

- [ ] 2.1 寫 failing test：drag idea 到 Day slot 具體時段 → INSERT entry + PATCH idea
- [ ] 2.2 寫 failing test：drag idea 到 Day header（無時段）→ smart placement
- [ ] 2.3 寫 failing test：drop 時段衝突 → 彈 ConflictModal
- [ ] 2.4 寫 failing test：ConflictModal 選換位置 → 自動擠既有 entry
- [ ] 2.5 寫 failing test：ConflictModal 選併排 → 兩者 order_in_day 相鄰
- [ ] 2.6 寫 failing test：drag 完成後 undo toast 5 秒可 revert
- [ ] 2.7 寫 failing test：API 失敗 → optimistic UI revert + error toast
- [ ] 2.8 建 `<DraggableIdeaCard>`
- [ ] 2.9 建 `<DroppableDayZone>`
- [ ] 2.10 建 `src/lib/drag-strategy.ts` smart placement 邏輯
- [ ] 2.11 建 `<ConflictModal>`

## 3. Drag-to-reorder (within-Day + cross-Day)

- [ ] 3.1 寫 failing test：同 Day 拖動 entry A 到 entry B 之上 → swap order
- [ ] 3.2 寫 failing test：cross-Day drag → 更新 day_id + smart placement
- [ ] 3.3 寫 failing test：batch update 正確（5 entries 一次 transaction）
- [ ] 3.4 建 `<DraggableEntry>`
- [ ] 3.5 refactor `ItineraryTabContent` 用 `<SortableContext>` 包 entries

## 4. Drag-to-demote (Itinerary → Ideas)

- [ ] 4.1 寫 failing test：drag promoted entry 到 Ideas → DELETE entry + 還原 idea
- [ ] 4.2 寫 failing test：drag 純 entry（無 idea source）到 Ideas → DELETE entry + INSERT 新 idea
- [ ] 4.3 寫 failing test：demote 彈確認 modal destructive warning
- [ ] 4.4 建 `<DroppableIdeasSection>`

## 5. Keyboard a11y

- [ ] 5.1 寫 failing test：Space pick up + Arrow move + Enter drop
- [ ] 5.2 寫 failing test：Esc cancel 回原位
- [ ] 5.3 dnd-kit KeyboardSensor 設定
- [ ] 5.4 screen reader announcement（aria-live region）

## 6. Batch API

- [ ] 6.1 寫 failing integration test：`PATCH /api/trip-entries/batch { updates: [{id, order_in_day, day_id, start_time}, ...] }` 單次 transaction
- [ ] 6.2 建 `functions/api/trip-entries/batch.ts` endpoint
- [ ] 6.3 D1 batch transaction 包 (all-or-nothing)

## 7. Drag overlay + sensor config

- [ ] 7.1 建 `<DragOverlay>` ghost (0.95x 縮放 + shadow + 2deg tilt)
- [ ] 7.2 TouchSensor `{ activationConstraint: { delay: 200, tolerance: 5 } }`
- [ ] 7.3 PointerSensor default 設定
- [ ] 7.4 KeyboardSensor

## 8. 驗證 + ship

- [ ] 8.1 Playwright E2E 4 種 drag scenario（promote / reorder / cross-day / demote）
- [ ] 8.2 Playwright iOS webkit test 長按 + drag
- [ ] 8.3 Playwright keyboard test（Tab + Space + Arrow + Enter）
- [ ] 8.4 `/design-review` drag hover state 視覺對齊 DESIGN.md
- [ ] 8.5 `/cso --diff` 驗 batch API 無 SQL injection
- [ ] 8.6 `/tp-team` pipeline
- [ ] 8.7 staging → prod ship
