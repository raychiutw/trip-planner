# Round 5c — functions/api/ Bearer CSRF + Constraint Re-classify + Atomic Batch

- **PR**: [#722](https://github.com/raychiutw/trip-planner/pull/722)
- **Version**: v2.33.43
- **Date**: 2026-05-24

## Findings

### HIGH (Bearer CSRF defense in depth)

| # | Location | Issue | Status |
|---|----------|-------|--------|
| H1 | `_middleware.ts:165` | Bearer 完全 skip CSRF check — XSS-stolen access_token 從 evil.com server-side 發 mutating call 即繞 Origin | ✅ Fixed: Bearer + Origin → 仍 enforce `isAllowedOrigin`，無 Origin (CLI/scheduler) 才 skip |

### MEDIUM (SQL error swallow → constraint re-classification)

| # | Location | Issue | Status |
|---|----------|-------|--------|
| M1 | `trips/[id]/entries/[eid].ts:152` PATCH catch | `SYS_DB_ERROR` 503 swallow 所有 SQLite error → UI / client retry 邏輯都受影響 | ✅ Fixed: UNIQUE → 409 DATA_CONFLICT / FK → 400 DATA_VALIDATION / 其他 503 |
| M2 | `trips/[id]/entries/[eid].ts:193` DELETE catch | 同上 | ✅ Fixed: FK 相依資料 → 409 |

### MEDIUM (atomic write — multi-POI invariant)

| # | Location | Issue | Status |
|---|----------|-------|--------|
| M3 | `entries/[eid]/trip-pois.ts:67-108` | INSERT trip_entry_pois + UPDATE trip_entries.entry_pois_version 分開 await — INSERT 成功 + UPDATE 失敗會留下 stale entry version → 破壞 OCC | ✅ Fixed: 合進同個 `db.batch([INSERT, UPDATE])` (D1 batch 整體 rollback) |

### Tests (+6)

- `round5c-security.test.ts` (source-grep):
  - middleware Bearer + Origin check wiring
  - entries[eid] PATCH/DELETE UNIQUE/FK re-classify
  - trip-pois batch atomicity

## Deferred to round 5d (defer task #122)

- `oauth/authorize.ts` `prompt=consent` 不 invalidate consent — 政策決定（per-user max-scope cap vs step-up auth）
- `entries/[num]/entries.ts` POST + `entries/[eid]/copy.ts` 同樣 split write 模式 — 體積大獨立 PR
- `oauth/reset-password.ts` / `oauth/send-verification.ts` 補 per-IP rate limit
- `account/connected-apps/[client_id].ts` revoke 加 cascade refresh-token revoke parity
