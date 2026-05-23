# Round 5a — functions/api/ Anonymous Read Hole (CRITICAL)

- **PR**: [#720](https://github.com/raychiutw/trip-planner/pull/720)
- **Version**: v2.33.41
- **Date**: 2026-05-23
- **Scope**: functions/api/ — 95 .ts files / 13,149 LOC（多輪拆解，5a 只處理 anonymous-read）

## CRITICAL

| # | Location | Issue | Status |
|---|----------|-------|--------|
| C1 | `_middleware.ts:415-417` + 6 GET handler | `GET /api/trips/**` 整路徑 bypass auth + 下游 handler 沒做 `published=1 OR hasPermission` check → 任何人 enumerate tripId 即讀全行程含 doc 航班 / hotel POI / 緊急聯絡 | ✅ Fixed: 新 `requireTripReadAccess()` helper + middleware 改 attach `auth=null` + 6 個 GET handler wire |

### Attack scenario

tripId 是 user-chosen lowercase slug (`^[a-z0-9-]+$/`)，極易猜（`tokyo-2026` / `okinawa-jul`）。`curl -X GET https://trip-planner-dby.pages.dev/api/trips/{guess}/docs` 即可拿到對方完整行程。

### Fix design

新 `requireTripReadAccess(db, auth, tripId)`:

```
published=1 → allow anonymous (public-share semantics)
published=0 + !auth → 403 PERM_DENIED
published=0 + auth + hasPermission → allow
published=0 + auth + 非 member → 403 PERM_DENIED
trip 不存在 → 404 DATA_NOT_FOUND
```

統一 403 (而非 401) 避免 enumerate published vs unpublished tripId — anti-enumeration。

### Handlers wired

- `trips/[id].ts` GET (root trip metadata)
- `trips/[id]/days.ts` GET (days list + `?all=1` batch)
- `trips/[id]/days/[num].ts` GET (single day)
- `trips/[id]/docs/index.ts` GET (v2.33.35 batch endpoint)
- `trips/[id]/docs/[type].ts` GET (single doc)
- `trips/[id]/segments/index.ts` GET (改 published-aware，原本 `requireAuth + hasPermission`)

### Behavior change

- 之前: `GET /api/trips/nope/days` → `200 []`
- 現在: `GET /api/trips/nope/days` → `404 DATA_NOT_FOUND`

## Tests added

- `tests/api/trips-read-access.integration.test.ts` (+13 case)
  - published anon OK (4 handler)
  - unpublished anon → 403 (6 handler)
  - unpublished + owner → 200, unpublished + 非 member → 403
  - nonexistent → 404
- `days.integration.test.ts` 2 個「不存在 → 空陣列」改「→ 404」對齊新 contract
