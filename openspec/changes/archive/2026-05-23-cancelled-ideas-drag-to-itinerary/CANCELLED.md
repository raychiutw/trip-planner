# CANCELLED — 2026-05-23

**Decision**: Ray 2026-05-23 拍板取消 SaaS pivot；本 proposal 原 deferred to
V2 Mindtrip-style layout，V2 既已取消，drag UX 失去 driver。

## Reasoning

Ideas drag UX 是 Mindtrip-style 開放 SaaS layout 的一環。沒有 SaaS pivot：

1. tripline 維持私人工具 + 2-user 規模
2. 既有 text-based promote button (saved POI → trip entry) 已足夠
3. dnd-kit 互動 + 4 種 drag action + Long-press / Undo / Smart placement
   投入 ROI 不成比例

Schema 已 ship 不會回退（`trip_entries.order_in_day` + 已 DROP 的
`trip_ideas.promoted_to_entry_id`），所以本取消決議**只影響 UI 層**。

## Related

- `docs/2026-04-24-saas-pivot-roadmap.md` (CANCELLED header)
- Memory `project_v2_oauth_decision` / `project_day0_demand_verify` 同步
  cancelled

未來若 user 對 drag UX 有具體需求可恢復本 proposal。
