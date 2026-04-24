## Context

Phase 1 準備 schema（`order_in_day` + `promoted_to_entry_id`）、Phase 3 建 Ideas tab UI。此 Phase 用 `@dnd-kit` 讓 Ideas ↔ Itinerary 互動 drag 化，符合 Mindtrip pattern（Image 12 觀察到 Ideas 加入後可拖拉）。

dnd-kit 是 React 生態的 de-facto drag library，prod-ready，支援 mouse + touch + keyboard（a11y），活躍維護。

## Goals / Non-Goals

**Goals:**
- 4 種 drag scenario 全實作（promote / reorder / cross-day / demote）
- Touch-friendly（手機 long-press + drag ghost 跟手指）
- Keyboard accessible（空白鍵 pick up + 方向鍵 move + enter drop）
- Undo toast 讓 drag 可 revert（網路 fail 時）
- 衝突處理（drop 時段與既有 entry 重疊）
- 時段智慧放置（無指定時段 drop 時 default 該 Day 最後 entry 之後）

**Non-Goals:**
- 不 drag 跨不同 trip（Ideas 綁 trip_id，只能同 trip 內）
- 不 drag 改 POI 本身資料
- 不做 multi-select drag（一次拖多個）— 複雜度不 justify
- 不改 Phase 3 既有「排入行程」text button（a11y fallback 保留）
- 不 drag 到 Map tab 或其他 tab（只 Ideas ↔ Itinerary）

## Decisions

### 1. Library: `@dnd-kit`（vs `react-beautiful-dnd` / `react-dnd`）
**為何**：dnd-kit 是 React 生態當前 state-of-the-art（2024-2026）：zero dependency、tree-shakable、支援 mouse/touch/keyboard、accessibility built-in、prod-ready used by Notion/etc。react-beautiful-dnd 已 deprecated（2024），react-dnd 太 low-level。
**備選**：無競爭者。

### 2. 兩種 draggable items: `idea-card` / `entry-card`
**為何**：dnd-kit 用 `useDraggable` + `id` + `data` 定義 draggable。Item 自帶 type 讓 drop handler 判斷合法目標。
**實作**：`DraggableIdeaCard` wraps Phase 3 Ideas card；`DraggableEntry` wraps Itinerary entry card。

### 3. Drop zones: Day time slots + Ideas section
**為何**：4 種 drag 對應 4 種 drop target：
- Day slot (with time range) — promote + cross-day + reorder-within-day
- Ideas section — demote
**實作**：`DroppableDayZone` per-day + `DroppableIdeasSection` 整個 Ideas tab。

### 4. 衝突處理：彈 modal 不阻擋
**為何**：drop 時段與既有 entry 重疊（例新 entry 9:00-11:00 但 9:30 已有 entry）→ modal 問「換位置（新 entry 擠）/ 併排（兩者同時段顯示）/ 取消」。
**備選**：自動 resolve（擠既有 entry 前後）— 使用者可能不期望，較不 explicit。

### 5. Smart placement: 無時段時塞該 Day 最後 entry 之後 1 小時
**為何**：使用者常只 drag 到「某 Day」不指定精確時段；系統應填合理 default（最後 entry + 1h，不跟現有衝突）。
**備選**：drop 時強制彈 time picker — 流暢性差。Smart default 更符合 Mindtrip UX。

### 6. Undo toast 5 秒 + 回 revert API
**為何**：drag 是 destructive 的 schema change（day_id / start_time 變動），給 undo 降低誤操作成本。
**實作**：drag 完成後立即 toast 5 秒，內含「undo」button；click → 呼叫 revert API 還原；5 秒後 commit 最終 state。
**技術 trade-off**：中間的 5 秒如果使用者關 tab，revert 失敗 → 接受（系統已 persist 最新 state，使用者不 undo 表示接受）。

### 7. Long-press 200ms on mobile（sensor config）
**為何**：手機 touch 直接 drag 容易誤觸（scroll vs drag 混淆）。200ms long-press 是 Mindtrip + Notion 等標準。
**實作**：`TouchSensor` with `activationConstraint: { delay: 200, tolerance: 5 }`。

### 8. Drag overlay 使用 `<DragOverlay>`
**為何**：dnd-kit 推薦 pattern — drag 時顯示 ghost layer 不改原 card 位置（避免 layout shift）。
**實作**：ghost = 縮小版 card + 半透明。

## Risks / Trade-offs

- **[Risk] Drag 時 API call 慢（網路差）使用者以為沒 response** → Mitigation: optimistic UI（drag 完成立即更新本地 state，背景 API persist）+ 失敗時 toast 提示並 revert
- **[Risk] 同時 drag 多個 card 的 race condition** → Mitigation: dnd-kit 支援但限制一次一個 active drag（non multi-select）
- **[Risk] iOS Safari 的 TouchSensor 不穩** → Mitigation: Playwright iOS webkit E2E 重點驗；必要時 fallback long-press 調整延遲時間
- **[Risk] Order_in_day 更新頻繁導致 D1 write 壓力** → Mitigation: drop 最終 commit 時一次 batch update 影響的 rows（非每次 drag move 都 update）
- **[Trade-off] 使用者切 tab / 網路斷線時 undo toast 失效** → acceptable（最終 state persist，只是 undo window 失效）

## Migration Plan

1. **Week 10 Day 1-2**：install dnd-kit + PoC sortable list
2. **Week 10 Day 3-4**：實作 DraggableIdeaCard + DroppableDayZone + promote flow
3. **Week 10 Day 5**：reorder within-day flow
4. **Week 11 Day 1**：cross-day move flow
5. **Week 11 Day 2**：demote flow (entry → ideas)
6. **Week 11 Day 3**：衝突 modal + smart placement + undo toast
7. **Week 11 Day 4**：Playwright E2E 4 種 drag + iOS webkit 驗
8. **Week 11 Day 5**：`/tp-team` + staging
9. **Week 12 Day 1**：ship prod
10. **Rollback**：revert commits；keep text-based promote button 仍可用，使用者不會完全失去功能

## Open Questions

- Drag overlay ghost 設計（semi-transparent card / outline / shadow）？**建議**：輕微縮小（0.95x）+ 強化 shadow + slight tilt（2deg）表示「舉起」
- 衝突時「併排」行為：是否在 UI 視覺區分（例並列 cards）？**建議**：V1 先不做併排視覺，只邏輯支援（同時段多 entry 的 order_in_day 排序）
- 使用者重 drag 時 undo 行為：第 2 次 drag 是否 cancel 第 1 次 undo？**建議**：是（最後一次 drag 才能 undo，避免 stack 複雜）
