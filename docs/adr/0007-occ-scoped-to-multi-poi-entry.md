# ADR-0007：OCC 只用在 entry 的 multi-POI，不擴散到其他表

- **Status**：Accepted（v2.27.0 起生效）
- **來源**：自 `ARCHITECTURE.md` 的 Key Architectural Decisions 搬入（2026-07-22）

## Context

一個 entry 可同時掛正選 + 多個備選 POI，多人同時編輯會互相覆蓋。需要並行控制。

## Decision

用 optimistic concurrency control，但**範圍限制在 multi-POI per entry**：`trip_entries.entry_pois_version` integer counter。其他表暫不導入。

## Consequences

- 版本衝突回 `409 STALE_ENTRY`，前端 refetch 後 retry。
- 刻意不擴散：避免 `IF version = X` 的寫法蔓延到每張表，讓多數單純寫入維持簡單。
- **代價**：其他表的並行寫入沒有保護，靠 workload 特性（少量寫、少並行）承擔。
