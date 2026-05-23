# Round 5d residuals (v2.33.55)

**日期**: 2026-05-24
**PR**: TBD (refactor/v2.33.55-round-5d-residuals → master)
**Module**: `functions/api/oauth/`, `functions/api/account/`, `functions/api/trips/`
**LOC**: ~50 lines

## 背景

backlog #122 — Round 5c defer 提到 4 個 backend residual。其中 oauth/reset-password
+ oauth/send-verification 已在 v2.33.52 round 8d 補 rate limit。剩 3 個：

1. ✅ `oauth/authorize.ts` `prompt=consent` 政策決定（加註解）
2. ✅ `entries POST / copy` non-atomic write → compensating delete
3. ✅ `account/connected-apps/[client_id].ts` revoke atomic batch

## Fix details

### 1. connected-apps revoke — atomic batch

**問題**: 之前 `consentAdapter.destroy()` + DELETE tokens 分兩步。
若第二步失敗 → consent 已刪但 token 仍有效，撤銷後 app 仍能呼叫 API
（security 缺口）。

**Fix**: `db.batch([deleteConsent, deleteTokens])` 一次原子執行。
拔掉 `consentAdapter.destroy()`，inline DELETE FROM oauth_models WHERE
name='Consent'。

**File**: `functions/api/account/connected-apps/[client_id].ts`

### 2. entries POST — compensating delete on syncEntryMaster failure

**問題**: INSERT trip_entries RETURNING id → `syncEntryMaster()` 兩段。
若 syncEntryMaster 失敗，entry 存在但無 master，後續 addAlternate 觸發
MISSING_MASTER 直到下次 GET self-heal。

**Fix**: `syncEntryMaster` 包 try/catch，失敗時 `DELETE FROM trip_entries
WHERE id = ?` 補救，throw `SYS_DB_ERROR`。D1 沒有 BEGIN/COMMIT cross-statement
transaction，best-effort 補救是現有 platform 能做的最好方案。

**File**: `functions/api/trips/[id]/days/[num]/entries.ts`

### 3. entries copy — compensating delete on stop POI batch failure

**問題**: INSERT trip_entries (新 entry) → `db.batch(INSERT trip_entry_pois × N)`
兩段。若 batch 失敗（UNIQUE constraint 衝突等），entry 存在但無 copied
stops（含 master）。

**Fix**: 同模式，batch 包 try/catch + compensating DELETE。

**File**: `functions/api/trips/[id]/entries/[eid]/copy.ts`

### 4. oauth/authorize prompt=consent — 政策註解

**狀況**: `prompt=consent` 既有邏輯（line 113-114）已正確 short-circuit
`needsConsent = true`，consent.ts POST 也用 `adapter.upsert()` overwrite
既有 consent row。無 code 改動需要，但缺政策決定文件。

**Fix**: 加註解說明設計：
- 既有 access/refresh tokens 保持有效，直到 TTL 或 user 走
  `/account/connected-apps` 手動 revoke
- consent.ts POST upsert overwrite 既有 row（新 scope 取代舊）
- 對應 OAuth 2.0 spec — `prompt=consent` 只強制 UI re-prompt，
  不 invalidate authorization 狀態；invalidate 是 token revocation
  endpoint 的責任

**File**: `functions/api/oauth/authorize.ts`

## Tests

`tests/unit/round-5d-residuals.test.ts` — 11 個 source-grep test:

- connected-apps: db.batch + 2 個 DELETE + 拔 destroy + 註解
- entries POST: try/catch + compensating DELETE + SYS_DB_ERROR rethrow
- entries copy: try/catch + compensating DELETE + SYS_DB_ERROR rethrow
- oauth/authorize: prompt=consent 邏輯保留 + policy 註解

`npm test` 全綠 2392 / 2392 (+11)。

## Status

- ✅ 4 個 residual fix 完成
- ✅ tsc clean
- ✅ 11 個新 regression test
- ✅ #122 (Round 5d) closes
