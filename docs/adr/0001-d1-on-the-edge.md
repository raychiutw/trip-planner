# ADR-0001：用 D1 跑在邊緣，不用 PostgreSQL

- **Status**：Accepted
- **來源**：自 `ARCHITECTURE.md` 的 Key Architectural Decisions 搬入（2026-07-22）

## Context

行程資料是 read-heavy、寫入量少。需要決定資料庫放哪。

## Decision

用 Cloudflare D1（SQLite）跑在邊緣節點，不另開 PostgreSQL server。

## Consequences

- D1 的 per-region replica + SQLite 讀取直接在 CF 邊緣節點跑，不需要維運獨立 DB server。
- **代價**：跨 region 寫入延遲較高。在這個 workload（少量寫）可接受。
- 連帶：沒有 PostgreSQL 的進階特性（如 partial index 的某些形式、複雜 CTE 效能），schema 演進走 `migrations/` + `migrations/rollback/`。
