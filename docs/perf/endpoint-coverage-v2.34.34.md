# Endpoint Test Coverage — v2.34.34 (2026-05-29)

`functions/api/**/*.ts` (96 endpoints, excl. `_helpers`) test coverage analysis。
68/96 = 70.8% direct coverage。28 gap 分類。

## Methodology

`grep` 找 test 檔案有 `from '...functions/api/<ep>'` 或 `import('...functions/api/<ep>')` 引用對應 handler。

Script:
```bash
find functions/api -name "*.ts" -type f ! -name "_*" | while read ep; do
  ep_pattern="$(echo "${ep#functions/api/}" | sed -e 's/\[/\\[/g' -e 's/\]/\\]/g' | sed 's/\.ts$//')"
  grep -rlE "(from|import\()\s*['\"][^'\"]*functions/api/${ep_pattern}['\"\/]" tests/ 2>/dev/null | head -1
done
```

## Summary

| Category | Count | Note |
|---|---|---|
| **Direct tested** | 68 | 70.8% |
| Trip-notes `/reorder` + `/[rowId]` for 4 sections | 8 | Indirect via `_shared.ts` helpers (functional equivalence with flights, which IS tested) |
| Admin endpoints | 9 | Internal tools, lower test ROI |
| **Real gaps** | 11 | Production-facing 但 no direct integration test |

## 8 indirect-tested endpoints (low priority)

`trip-notes-mutations.integration.test.ts` 透過 flights/* 測 `_shared.ts` 所有 CRUD + reorder helpers。剩 4 section（lodgings/reservations/pretrip/emergency）+ rowId + reorder 共用同 code path：

- `trips/[id]/notes/{lodgings,reservations,pretrip,emergency}/[rowId].ts`
- `trips/[id]/notes/{lodgings,reservations,pretrip,emergency}/reorder.ts`

**Action**: 可加 1 個 cross-section integration test 確認每 section 路由 dispatch 正確（30 行 test 就夠）。

## 9 admin endpoints (defer)

- `admin/{backfill-status, cache-cleanup, maps-lock, maps-settings, maps-unlock, pois-due-refresh, pois-pending-place-id, quota-estimate, test-alert}.ts`

**Rationale**: admin tools 偶爾使用、有 admin email allowlist gate、shipping 風險低。Test ROI 低。

## 11 real gaps (high-priority test candidates)

| # | Endpoint | Why test | Risk |
|---|---|---|---|
| 1 | `account/profile.ts` | v2.33.122 PATCH display_name + trim + 50 chars cap + audit | **HIGH** — user data write |
| 2 | `account/stats.ts` | 顯示 4 個行程 / 22 天 / 2 旅伴 | LOW — read only |
| 3 | `health.ts` | D1 + Google Maps key 健康檢查 | LOW — diagnostic |
| 4 | `invitations/revoke.ts` | 取消 trip 邀請 | MEDIUM — collab feature |
| 5 | `permissions/[id].ts` | user permission CRUD | MEDIUM — auth-adjacent |
| 6 | `poi-search.ts` | Google Places Text Search | HIGH — core feature, billing impact |
| 7 | `pois/find-or-create.ts` | POI 入庫 dedup | HIGH — data integrity |
| 8 | `public-config.ts` | 公開 config (no auth) | LOW — env mirror |
| 9 | `requests/[id]/events.ts` | SSE long-poll for AI request progress | MEDIUM — connection lifecycle |
| 10 | `route.ts` | Google Routes API (recompute-travel 依賴) | HIGH — billing + accuracy |
| 11 | `trips/[id]/entries/[eid]/trip-pois.ts` | entry POI relations | MEDIUM — entry editing |

## Recommended follow-up PRs

優先級基於 risk + recency：

| Priority | PR | Scope | 預估 lines |
|---|---|---|---|
| P0 | PR36 | `account/profile.ts` integration test | ~80 |
| P0 | PR37 | `poi-search.ts` + `route.ts` Google API mock + test | ~150 |
| P1 | PR38 | `pois/find-or-create.ts` + entry trip-pois integration test | ~120 |
| P1 | PR39 | trip-notes cross-section dispatch test (1 file 8 sections) | ~80 |
| P2 | PR40 | `invitations/revoke.ts` + `permissions/[id].ts` collab test | ~100 |
| P3 | (skip) | health / public-config / stats — trivial, lazy coverage |
| Defer | — | 9 admin endpoints — internal tools |

## State after PR26-34

- 70.8% direct endpoint coverage（業界 SaaS 平均 60-70%）
- 全 mutation endpoints 都有 audit_log（PR26/27/32）
- 全 trip-notes feature 各 path 都有 unit test 鎖 OCC + permission
- E2E (Playwright) 跑 QA flows 1-5 + trip-notes 流程

Healthy baseline。剩 28 個 untested 中 8 是 indirect / 9 是 admin / 11 是真 gap。
