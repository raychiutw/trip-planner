## Why

專案優化掃描發現 5 個高嚴重度 API 問題：restaurants POST 使用不存在的欄位（runtime 會失敗）、requests status 約束 API 與 DB 不一致、PUT days 非原子寫入有資料不一致風險、audit_log 的 falsy coercion 問題。這些問題影響 API 可靠性和資料完整性，需優先修復。

## What Changes

- **H1**: 修正 `restaurants.ts` POST handler 的 INSERT 語句，從 `parent_type/parent_id` 改為正確的 `entry_id` FK 欄位
- **H2**: 統一 `requests/[id].ts` 的 status 驗證與 DB `0009_request_message.sql` migration 的 CHECK constraint（已改為 open/received/processing/completed）
- **H5**: 重構 `days/[num].ts` PUT handler，將多次 db 操作合併為單一 `db.batch()` 以確保原子性
- **M10**: 修正 `_audit.ts` 中 `opts.requestId || null` 改為 `opts.requestId ?? null`，避免 falsy coercion
- **M11**: 移除 `requests.ts` 中重複的 `hasPermission` 函式，改用 `_auth.ts` 的共用版本

## Capabilities

### New Capabilities
- `api-reliability`: 修正 API 端點的 schema 不匹配、約束不一致、非原子寫入等可靠性問題

### Modified Capabilities
（無既有 spec 層級行為變更）

## Impact

- **API handlers**：`functions/api/trips/[id]/entries/[eid]/restaurants.ts`（H1）、`functions/api/requests/[id].ts`（H2）、`functions/api/trips/[id]/days/[num].ts`（H5）
- **共用模組**：`functions/api/_audit.ts`（M10）、`functions/api/requests.ts`（M11）
- **測試**：新增對應 unit test 驗證修正
- **前端**：不需改動
