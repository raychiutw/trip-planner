# ADR-0002：POI master + per-entry 備選，拔掉 trip-scoped override 中間層

- **Status**：Accepted（v2.29.0 起生效）
- **來源**：自 `ARCHITECTURE.md` 的 Key Architectural Decisions 搬入（2026-07-22）

## Context

每個 entry 需要能掛 1 個正選 + N 個備選 POI。早期用 `trip_pois` 中間層做 trip-scoped override（讀取時 COALESCE 覆蓋 master 欄位）。

## Decision

- `pois` 是 **immutable master**（由 Google Place Details refresh 維護）。
- `trip_entry_pois` junction（entry × poi M:N + `sort_order`）：`sort_order = 1` 是正選，`> 1` 是備選。
- v2.29.0 把 `trip_pois` 整表 rip-out，改為純 reference，不再有 trip-scoped 欄位覆蓋。

## Consequences

- 實測使用者客製率低，但 override 中間層的維運成本高（每個讀取路徑都要 COALESCE）——移除後讀取路徑單純化。
- Trip-scoped 的自由文字改寫進 `trip_entries.note` 與 `trip_entry_pois.metadata`。
- 住宿改掛 `trip_days.hotel_poi_id`（FK），不再用 `trip_pois` 的 context 欄位。
- 詞彙後果見 `CONTEXT.md`：`trip_pois` 是**已退場**的名字。
