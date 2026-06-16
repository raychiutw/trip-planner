# Plan: 移除全域 admin → 純 owner/permissions + 細粒度 ops scope

**狀態**: Plan locked（/plan-eng-review + outside voice 完成）
**決策來源**: 2026-06-15 user「徹底細化」+ /plan-eng-review D1-D5 + security-auditor F1-F4
**性質**: 安全敏感授權邊界 refactor，跨 middleware + 維運 endpoint + service token + cron scripts + D1 migration

---

## 1. 目標

- **移除「admin 帳號」**：人類（含 Ray）登入後只是自己 trip 的 owner，無跨 trip 上帝權限。
- **service token 籠統 `admin` scope → 細粒度 ops scopes**：每個維運/跨-trip endpoint 自檢 scope，消除 `isAdmin` bypass。
- **徹底清理**（D1）：`ADMIN_EMAIL` env、per-trip `role='admin'` 死碼、`AuthData.isAdmin`（連 **40 檔案/57 處** 消費端，F3 實測）。
- **刪除 test-alert**（D2）。

非目標：不動 owner/permissions 模型、companion 機制。

---

## 2. 現狀依賴圖（已讀 code + outside voice 驗證）

### isAdmin 兩個產生源
| 源 | 位置 | 條件 |
|----|------|------|
| user-session | `_middleware.ts:318/432/477` | `email === env.ADMIN_EMAIL` |
| service-token | `_middleware.ts:463` | `scopes.includes('admin')`，user_id=null |

### isAdmin 消費端（完整版，F3 修正）
| 類 | 端點 | bypass 性質 |
|----|------|------------|
| `/api/admin/*` ×8（test-alert 刪） | requireAdmin gate | service-token 維運 |
| **master POI 寫入**（F1）| `pois/[id].ts:45`(PATCH) `:80`(DELETE) `pois/[id]/enrich.ts:45` | **cron 靠 admin bypass 寫**（跨 trip 無 owner）|
| per-trip 特權 | `trips/[id]/audit.ts:12` `audit/[aid]/rollback.ts:51` | 有 tripId |
| 旅伴請求 | `requests.ts` / `requests/[id]/*` | service-token |
| 跨 trip 讀 | `GET /api/trips?showAll`、`my-trips.ts`、`permissions.ts` | 讀取放大 |
| _auth bypass ×3 | `_auth.ts:44/92/114` | `if(isAdmin) return true` **在** isServiceToken 檢查前 |
| **消費總量** | **40 檔案 / 57 處 `auth.isAdmin`**（F3 grep 實測，非「~15」）+ tests/ ~30 處 mock（F4）|

### 關鍵語意
- admin-scope service token **能** bypass 寫個別 trip + **master POI**（F1）。個別 trip 實務無 cron 用；**master POI cron 正在用**（refresh-30d/initial-backfill）。
- companion 走 `_companion.ts` resolve **真實 user_id** 寫 poi-favorites（不靠 admin，已驗證 `poi-favorites.ts:149`）。
- `trips:read`/`trips:write` scope 無 enforcement。SEC-8 audit 已用 sentinel（細化不影響 audit）。
- migration（0047:75）：`trip_permissions` 無 children FK → 標準 swap idiom。

---

## 3. scope 設計（D2+D4+F1 後）

### service-token ops scopes（4 個）
| scope | 端點 | cron 消費者 |
|-------|------|------------|
| `ops:maps` | maps-lock/unlock/settings, quota-estimate | daily-check, google-quota-monitor |
| `ops:poi`（**含 master POI 寫入**，F1）| backfill-status, pois-due-refresh, pois-pending-place-id, **`pois/[id]` PATCH/DELETE, `pois/[id]/enrich`** | poi-initial-backfill, poi-refresh-30d |
| `ops:cache` | cache-cleanup | google-quota-monitor |
| `ops:trips:read` | `GET /api/trips?showAll`, requests 管理 | daily-report, 旅伴請求 scheduler |
| `companion`（不動）| poi-favorites/* | tp-request scheduler |

新 cron token scope = `["ops:maps","ops:poi","ops:cache","ops:trips:read","companion"]`。**test-alert 刪除**。

### per-trip 端點改 owner gate（D4，非 ops scope）
- `trips/[id]/audit.ts`、`audit/[aid]/rollback.ts` → `hasWritePermission`（owner 看/rollback 自己 trip，對齊 owner 模型）。

### 新 gate helper（`_auth.ts`）
```
requireScope(ctx, required):
  auth = requireAuth(ctx)
  if auth.isServiceToken && auth.scopes?.includes(required): return auth
  if auth.isServiceToken && auth.scopes?.includes('admin'): return auth   // ← Phase 1 雙接受，Phase 3 刪
  throw PERM_DENIED
```
user-session 不帶 `scopes` → 無法偽造（Q4 已驗證）。endpoint 從 Phase 1 寫死 ops scope，兩階段不變。

### 授權決策樹（最終態）
```
request
 ├─ user-session ──► owner/permissions only（無 admin bypass）
 │     ├─ 寫個別 trip: hasWritePermission（owner/member ✓ viewer ✗）
 │     └─ audit/rollback: hasWritePermission（owner 自主）        ← D4
 ├─ service-token ──► scope-gated
 │     ├─ /api/admin/* ──► requireScope('ops:maps'|'ops:cache'|'ops:poi')
 │     ├─ pois/:id 寫入 ──► requireScope('ops:poi')               ← F1
 │     ├─ trips?showAll / requests ──► requireScope('ops:trips:read')
 │     ├─ poi-favorites ──► companion gate（resolve 真實 user_id）
 │     └─ 個別 trip 寫入 ──► isServiceToken → ✗（無 admin bypass）
 └─ anonymous ──► published-only
```

---

## 4. 部署順序（phase split）

- **Phase 1（PR1，向後相容）**
  - `_middleware.ts` 3 處 user-session isAdmin → `false`。
  - `_auth.ts` 新增 `requireScope`（含集中 admin fallback）。
  - 8 個 `admin/*` + showAll + **`pois/[id]` PATCH/DELETE + enrich**（F1）→ `requireScope('ops:*')`。
  - **audit/rollback → `hasWritePermission`**（D4，per-trip owner gate，非雙接受）。
  - requests 端點 → `requireScope('ops:trips:read')`（雙接受）。
  - 不動 token。
  - ✅ cron 持舊 admin token 仍正常；人類降 owner。canary smoke：Ray 登入確認 trips + POI 維運未斷。

- **Phase 2（運維 + cron code）**
  - **先修 F2**：`provision-admin-cli-client.js:142-146` cascade-revoke 改打真實表
    `DELETE FROM oauth_models WHERE name IN ('AccessToken','RefreshToken') AND json_extract(payload,'$.client_id')=?`
    + 撤銷失敗改 **hard-fail**（不發新 secret）。
  - `allowedScopes` 改 4 ops scope → `--rotate-secret` 重發（此時撤銷真生效）→ 更新 mac mini launchd plist secret。
  - `get-tripline-token.js` / `cron-shared.ts` 預設 scope `'admin'` → 對應 ops scope；5 cron script 各帶對應 scope。
  - **硬順序**：Phase 1 上 prod → 修+rotate（驗舊 token 即 401）→ 更新 secret → 驗 cron 全綠 → 才 Phase 3。

- **Phase 3（PR3，移除舊機制）**
  - `_middleware.ts:463` service-token admin 移除；`_auth.ts` 移除 bypass×3 + requireAdmin + requireScope admin fallback。
  - 8 endpoints + showAll + pois + requests 撤雙接受。
  - **`AuthData.isAdmin` 徹底移除**（D1）+ **40 檔案/57 處** 消費端（F3 完整 checklist）+ helper signature + **tests/ ~30 處 mock**（F4，同 PR 否則 CI 紅）。
  - **刪 test-alert**（D2）+ test。
  - `ADMIN_EMAIL` 從 `_types.ts` + CF dashboard 移除。
  - migration：`trip_permissions.role` CHECK 去 `'admin'`（標準 swap + INSERT SELECT 前 assert `COUNT(role='admin')=0` 否則 ABORT）+ 清防守碼。
  - CLAUDE.md:3 更新。

---

## 5. 要改的檔案

**Phase 1**: `_middleware.ts`(isAdmin×3)、`_auth.ts`(+requireScope)、`admin/*.ts`×8、`pois/[id].ts`、`pois/[id]/enrich.ts`（F1）、`trips/[id]/audit.ts`、`audit/[aid]/rollback.ts`（D4）、`requests.ts`+`requests/[id]/*`、`trips.ts`(showAll)
**Phase 2**: `provision-admin-cli-client.js`（rotation fix F2 + scope）、`get-tripline-token.js`、`cron-shared.ts`、5 cron scripts
**Phase 3**: `_middleware.ts`、`_auth.ts`、`_types.ts`、`src/types/api.ts`(AuthData.isAdmin) + **40 檔案** `auth.isAdmin` 消費端、`tests/api/helpers.ts`/`__factories__/*` 等 ~30 mock（F4）、`permissions.ts`/`permissions/[id].ts`、`admin/test-alert.ts`(刪)、新 migration、CLAUDE.md、wrangler/CF env

---

## 6. Test Plan

新增測試：
- `requireScope`：ops:maps → 過 maps / 擋 poi（scope 隔離）；Phase1 舊 admin → 過；Phase3 舊 admin → 拒。
- **service-token 寫 master POI**（F1）：ops:poi → `pois/[id]` PATCH/DELETE + enrich 過；無 ops:poi → 401。
- **rotate 後舊 token 打 `/api/admin/*` → 401**（F2 驗撤銷真生效）。
- audit/rollback：owner 過、非 owner 擋（D4）。
- user admin email 登入 → isAdmin 不存在，只能存取自己 trip。
- migration：role='admin' row 存在 → ABORT。

**REGRESSION（CRITICAL，強制，F3）**：移除 `auth.isAdmin` 第四參數動 **40 檔案/57 處**，逐檔 checklist（grep `auth.isAdmin` 全清單）；owner/member 寫入 + viewer 擋寫回歸不變。重用 `tests/api/middleware-service-token.integration.test.ts`。

---

## 7. Required outputs

### NOT in scope
- service token SPOF（拆多 client）— 另案。
- `trip_permissions` `email='*'` wildcard（0047:72）— 另案 `public_trips` column。
- quota-estimate env 名稱 bug（learning `gcp-monitoring-env-name-mismatch`）— 既有，flag 不修。

### What already exists（重用）
- owner/permissions 模型、OAuth `scopes`+`_companion.ts` gate pattern、`middleware-service-token.integration.test.ts`、migration 0047:77-91 swap 樣板。

### Failure modes
| codepath | 失敗 | 測試 | 錯誤處理 | 可見 |
|----------|------|------|---------|------|
| requireScope scope 缺 | 403 | ✅ | PERM_DENIED | ✅ |
| **pois 寫入無 ops:poi**（F1）| cron 401 靜默停更 POI | ✅(F1 測) | 403 | cron log |
| **rotation 撤銷**（F2）| 舊 token 活 1h | ✅(rotate 後 401 測) | hard-fail | operator |
| migration role CHECK | ABORT | ✅ assert | txn ABORT | 非靜默 |
| isAdmin 第四參數移除 | owner 寫不了 | ✅ REGRESSION | — | 403 非靜默 |

F1 修前是「靜默停更 + 無測試」的 critical gap → 已納入測試 + scope。

### Worktree parallelization
Phase 間 sequential（部署依賴）。Phase 內共用 `requireScope`/signature，sequential 較安全。**No parallelization opportunity.**

### Implementation Tasks
- [ ] **T1 (P1)** — Phase 1：requireScope + 8 admin + pois 寫入(F1) + showAll + requests → ops scope；audit/rollback → owner gate(D4)；user isAdmin→false。
- [ ] **T2 (P1)** — Phase 2：**先修 provision rotation(F2)** → scope 改 → rotate → launchd secret → cron scripts scope。Verify: 舊 token 401 + cron 全綠。
- [ ] **T3 (P1)** — Phase 3：移除 admin 殘留 + AuthData.isAdmin(40 檔/57 處 checklist) + tests mock(F4) + migration + 刪 test-alert。
- [ ] **T4 (P2)** — /ship bump VERSION 第三碼、不動 package.json（learning）。

---

## 8. Review 決策記錄
- **D1** AuthData.isAdmin → 徹底移除 | **D2** test-alert → 刪除 | **Issue1** 不加 Phase 0（canary smoke 代）
- **D4** per-trip(audit/rollback)→ owner gate；跨 trip/service(pois/requests)→ ops scope
- **D5** F2 rotation cascade-revoke → Phase 2 前修 + hard-fail
- **F1** master POI 寫入路徑納入 ops:poi（Phase 1 +3 endpoint）| **F3** isAdmin 消費 40 檔/57 處 | **F4** tests mock 同 PR

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | backend authz，無產品 scope 變動 |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | errored | 環境 block（claude-pulse），fell back |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_open→folded | 1 arch(Issue1) + scope/test 折入 |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | backend-only，N/A |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | N/A |

- **OUTSIDE VOICE (security-auditor subagent):** 2 P1 (F1 漏列 master POI 寫入路徑無 ops scope；F2 rotation cascade-revoke 打不存在表) + F3(isAdmin 消費低估 2.5×) + F4(tests mock)。全部已折入 plan。背書 Q1/Q3/Q4/Q5 處理得當。
- **CROSS-MODEL:** 無分歧 — outside voice 補了 review 漏掉的 F1/F2，非衝突。Codex 環境失敗，security-auditor 替補。
- **VERDICT:** ENG CLEARED（5 決策 + 4 findings 全折入 plan）— ready to implement。Design/CEO N/A（backend-only authz）。

NO UNRESOLVED DECISIONS
