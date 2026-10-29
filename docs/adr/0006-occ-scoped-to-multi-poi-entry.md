# ADR-0006：OCC 只用在 entry 的 multi-POI，不擴散到其他表

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

## 既有整日版本契約補記（2026-09-21，#1285）

migration 0065 已提供 `trip_days.version` 與 PUT day 的選填 `expectedDayVersion`；這是既有整日替換入口的前置比對，並非本次擴張全站 OCC。未傳 token 的既有呼叫仍可替換。成功替換時 day version 加一，必要寫入失敗則一起回滾。`trip_entries.version` 與 multi-POI 的 `entry_pois_version` 仍是不同欄位。

整日替換改為一個 D1 batch transaction，junction 用同批次內的 day ID 與 sort order 查得新 entry ID，避免先提交刪除再串接 ID。[D1 batch 文件](https://developers.cloudflare.com/d1/worker-api/d1-database/) 說明其中任一 statement 失敗會回滾整批；[平台限制](https://developers.cloudflare.com/d1/platform/limits/) 的參數／SQL 長度限制套用每個 statement，批次另受執行時間限制。測試以 60 個 entry（超過既有 `BATCH_CHUNK=50`）涵蓋成功、後段故障及重試。若平台拒絕整批，API 回報失敗，保留舊 day；沒有跨批次補償或恢復日誌。
