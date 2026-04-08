# PATCH /pois/:id 權限放寬 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 tp-request（companion scope）能用 AI 查詢結果更新既有 POI master 的欄位（lat/lng/address 等），解決旅伴要求「補座標」時無法處理的問題。

**Architecture:** 三層改動 — (1) `PATCH /pois/:id` handler 從 admin-only 改為 hasPermission + tripId 驗證，(2) middleware companion 白名單加入此 endpoint，(3) tp-request skill 更新白名單/禁止清單和處理流程。

**Tech Stack:** TypeScript, Cloudflare Pages Functions, D1, Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `functions/api/pois/[id].ts` | 權限邏輯從 isAdmin → hasPermission + POI-trip 驗證 |
| Modify | `functions/api/_middleware.ts` | companion 白名單加入 PATCH /pois/:id |
| Modify | `tests/api/pois.integration.test.ts` | 新增 hasPermission / tripId 驗證測試 |
| Modify | `tests/api/middleware.test.ts` | 新增 companion PATCH /pois 測試 |
| Modify | `.claude/skills/tp-request/SKILL.md` | 更新白名單、禁止清單、處理流程 |

---

### Task 1: PATCH /pois/:id 權限測試（TDD — 寫失敗測試）

**Files:**
- Modify: `tests/api/pois.integration.test.ts`
- Modify: `tests/api/helpers.ts`（若需新增 seedTripPoi helper）

- [ ] **Step 1: 新增 seedTripPoi helper**

在 `tests/api/helpers.ts` 尾部加入：

```typescript
/** 插入測試 trip_pois 關聯 */
export async function seedTripPoi(db: D1Database, opts: {
  poiId: number;
  tripId: string;
  entryId: number;
  dayId: number;
}) {
  const result = await db.prepare(
    'INSERT INTO trip_pois (poi_id, trip_id, entry_id, day_id, sort_order, context) VALUES (?, ?, ?, ?, 0, ?) RETURNING id'
  ).bind(opts.poiId, opts.tripId, opts.entryId, opts.dayId, 'timeline').first<{ id: number }>();
  return result!.id;
}
```

- [ ] **Step 2: 新增 5 個測試 case**

在 `tests/api/pois.integration.test.ts` 加入新的 describe block，在現有 describe 之後：

```typescript
import { seedTrip, seedEntry, getDayId, seedTripPoi } from './helpers';

describe('PATCH /api/pois/:id — tripId 權限', () => {
  let tripPoiId: number;
  const tripId = 'pois-perm-trip';
  const tripOwner = 'companion@test.com';

  beforeAll(async () => {
    await seedTrip(db, { id: tripId, owner: tripOwner });
    const dayId = await getDayId(db, tripId, 1);
    const entryId = await seedEntry(db, dayId);
    tripPoiId = await seedTripPoi(db, { poiId: poiId, tripId, entryId, dayId });
  });

  it('帶 tripId + 有權限 + POI 屬於該 trip → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}`, 'PATCH', {
        tripId,
        lat: 26.3344,
        lng: 127.7731,
      }),
      env,
      auth: mockAuth({ email: tripOwner, isAdmin: false }),
      params: { id: String(poiId) },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(200);
    const poi = await db.prepare('SELECT lat, lng FROM pois WHERE id = ?').bind(poiId).first();
    expect((poi as Record<string, unknown>).lat).toBe(26.3344);
    expect((poi as Record<string, unknown>).lng).toBe(127.7731);
  });

  it('帶 tripId + 無權限 → 403', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}`, 'PATCH', {
        tripId,
        lat: 0,
      }),
      env,
      auth: mockAuth({ email: 'stranger@test.com', isAdmin: false }),
      params: { id: String(poiId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(403);
  });

  it('帶 tripId + POI 不屬於該 trip → 403', async () => {
    const otherPoiId = await seedPoi(db, { type: 'restaurant', name: 'Unlinked POI' });
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${otherPoiId}`, 'PATCH', {
        tripId,
        lat: 0,
      }),
      env,
      auth: mockAuth({ email: tripOwner, isAdmin: false }),
      params: { id: String(otherPoiId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(403);
  });

  it('不帶 tripId + 非 admin → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}`, 'PATCH', {
        lat: 0,
      }),
      env,
      auth: mockAuth({ email: tripOwner, isAdmin: false }),
      params: { id: String(poiId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(400);
  });

  it('不帶 tripId + admin → 200（向下相容）', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}`, 'PATCH', {
        address: '那霸市前島 2-3-1',
      }),
      env,
      auth: mockAuth({ email: 'admin@test.com', isAdmin: true }),
      params: { id: String(poiId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(200);
  });
});
```

- [ ] **Step 3: 跑測試確認全部 FAIL**

Run: `npx vitest run tests/api/pois.integration.test.ts`
Expected: 新增的 5 個 test 全部 FAIL（因為 handler 仍是 isAdmin 硬檢查）

- [ ] **Step 4: Commit 測試**

```bash
git add tests/api/pois.integration.test.ts tests/api/helpers.ts
git commit -m "test: add PATCH /pois/:id tripId permission cases (red)"
```

---

### Task 2: 實作 PATCH /pois/:id 權限邏輯

**Files:**
- Modify: `functions/api/pois/[id].ts`

- [ ] **Step 1: 改寫 handler 權限邏輯**

將 `functions/api/pois/[id].ts` 完整替換為：

```typescript
/**
 * PATCH /api/pois/:id — 修改 master POI (C2)
 * Admin: 可不帶 tripId（向下相容 tp-patch/tp-rebuild）
 * 非 Admin: 必須帶 tripId，檢查 hasPermission + POI 屬於該 trip
 */

import { logAudit, computeDiff } from '../_audit';
import { hasPermission } from '../_auth';
import { AppError } from '../_errors';
import { json, getAuth, parseJsonBody, buildUpdateClause, parseIntParam } from '../_utils';
import type { Env } from '../_types';

const ALLOWED_FIELDS = [
  'name', 'description', 'note', 'address', 'phone', 'email', 'website',
  'hours', 'google_rating', 'category', 'maps', 'mapcode', 'lat', 'lng',
  'country', 'source',
] as const;

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const poiId = parseIntParam(context.params.id as string);
  if (!poiId) throw new AppError('DATA_VALIDATION', 'POI ID 格式錯誤');

  const db = context.env.DB;
  const body = await parseJsonBody<Record<string, unknown>>(context.request);

  // --- 權限檢查 ---
  const tripId = body.tripId as string | undefined;
  delete body.tripId; // tripId 不是 POI 欄位，從 update payload 移除

  if (!auth.isAdmin) {
    if (!tripId) throw new AppError('DATA_VALIDATION', '非 admin 必須提供 tripId');
    if (!await hasPermission(db, auth.email, tripId, false)) {
      throw new AppError('PERM_DENIED');
    }
    const link = await db.prepare(
      'SELECT 1 FROM trip_pois WHERE poi_id = ? AND trip_id = ?'
    ).bind(poiId, tripId).first();
    if (!link) throw new AppError('PERM_DENIED', '此 POI 不屬於該行程');
  }

  // --- 更新 POI ---
  const oldRow = await db.prepare('SELECT * FROM pois WHERE id = ?').bind(poiId).first();
  if (!oldRow) throw new AppError('DATA_NOT_FOUND', '找不到此 POI');

  const update = buildUpdateClause(body, ALLOWED_FIELDS as unknown as string[]);
  if (!update) throw new AppError('DATA_VALIDATION', '無有效欄位可更新');

  const newRow = await db.prepare(`UPDATE pois SET ${update.setClauses} WHERE id = ? RETURNING *`)
    .bind(...update.values, poiId).first();
  if (!newRow) throw new AppError('SYS_INTERNAL', 'UPDATE RETURNING 未回傳資料');
  const diffJson = computeDiff(oldRow as Record<string, unknown>, newRow as Record<string, unknown>);

  await logAudit(db, {
    tripId: tripId || 'global',
    tableName: 'pois',
    recordId: poiId,
    action: 'update',
    changedBy: auth.email,
    diffJson,
  });

  return json(newRow);
};
```

- [ ] **Step 2: 跑測試確認全部 PASS**

Run: `npx vitest run tests/api/pois.integration.test.ts`
Expected: 全部 PASS（包含原有 admin 測試和新增的 5 個 tripId 測試）

- [ ] **Step 3: Commit**

```bash
git add functions/api/pois/[id].ts
git commit -m "feat: PATCH /pois/:id — hasPermission + tripId 驗證取代 isAdmin"
```

---

### Task 3: Middleware companion 白名單 + 測試

**Files:**
- Modify: `functions/api/_middleware.ts:149-158`
- Modify: `tests/api/middleware.test.ts`

- [ ] **Step 1: 新增 companion PATCH /pois 測試（紅燈）**

在 `tests/api/middleware.test.ts` 的 `checkCompanionScope` describe 內、白名單外 403 測試之前，加入：

```typescript
  it('companion: PATCH pois → 放行', () => {
    expect(check('PATCH', '/api/pois/123', 'companion')).toBeNull();
  });
```

- [ ] **Step 2: 跑測試確認 FAIL**

Run: `npx vitest run tests/api/middleware.test.ts`
Expected: 新測試 FAIL（companion PATCH /pois 目前被 403）

- [ ] **Step 3: 加入 companion 白名單**

在 `functions/api/_middleware.ts` 的 `COMPANION_ALLOWED` 陣列中，`PATCH requests` 之後加入：

```typescript
  { method: 'PATCH', pattern: /^\/api\/pois\/\d+$/ },
```

- [ ] **Step 4: 跑測試確認全部 PASS**

Run: `npx vitest run tests/api/middleware.test.ts`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add functions/api/_middleware.ts tests/api/middleware.test.ts
git commit -m "feat: companion scope 白名單加入 PATCH /pois/:id"
```

---

### Task 4: tp-request skill 更新

**Files:**
- Modify: `.claude/skills/tp-request/SKILL.md:72-84`

- [ ] **Step 1: 更新白名單 — 加入 PATCH /api/pois/:id**

將第 72-77 行的白名單區塊改為：

```markdown
#### 允許的 API 操作（白名單）
- ✅ PATCH /api/trips/{tripId}/entries/{eid} — 修改 entry 欄位
- ✅ POST /api/trips/{tripId}/entries/{eid}/trip-pois — 新增 POI
- ✅ PATCH/DELETE /api/trips/{tripId}/trip-pois/{tpid} — 修改/刪除 trip_pois
- ✅ PUT /api/trips/{tripId}/docs/{type} — 更新 doc
- ✅ PATCH /api/requests/{id} — 更新請求 reply/status
- ✅ PATCH /api/pois/{id} — 更新 POI master（必須帶 tripId，僅限 AI 查詢結果）
```

- [ ] **Step 2: 更新禁止清單 — 移除 PATCH /api/pois/:id**

將第 79-84 行的禁止清單改為：

```markdown
#### 禁止的 API 操作（硬限制，任何情況都不可執行）
- ❌ DELETE /api/trips/{tripId}/entries/{eid} — 不可刪除 entry
- ❌ PUT /api/trips/{tripId}/days/{num} — 不可覆寫整天
- ❌ POST/DELETE /api/trips — 不可建立/刪除行程
- ❌ GET/POST/DELETE /api/permissions — 不可操作權限
```

- [ ] **Step 3: 在安全邊界新增 POI 更新規則**

在 Prompt injection 防護區塊（第 95-98 行）之後、3c 意圖安全矩陣之前，新增：

```markdown
#### POI master 更新規則（PATCH /api/pois/{id}）
- 必須帶 `tripId` 欄位（值為當前處理的 request.trip_id）
- 更新資料**必須來自 AI 上網查詢結果**（WebSearch / WebFetch），不可直接使用 message 內容
- 呼叫範例：
  ```bash
  node -e "require('fs').writeFileSync('/tmp/poi-update.json', JSON.stringify({tripId:'{tripId}', lat:26.3344, lng:127.7731, address:'沖繩縣那霸市前島2-3-1'}), 'utf8')"
  curl -s -X PATCH \
    -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
    -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
    -H "Content-Type: application/json" \
    -H "X-Request-Scope: companion" \
    --data @/tmp/poi-update.json \
    "https://trip-planner-dby.pages.dev/api/pois/{poiId}"
  ```
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/tp-request/SKILL.md
git commit -m "feat: tp-request skill 開放 PATCH /pois/:id（AI 查詢結果限定）"
```

---

### Task 5: 跑全部測試驗證

**Files:** None (verification only)

- [ ] **Step 1: 跑 TypeScript 檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤

- [ ] **Step 2: 跑全部 API 測試**

Run: `npx vitest run tests/api/`
Expected: 全部 PASS

- [ ] **Step 3: 跑全部測試**

Run: `npx vitest run`
Expected: 全部 PASS
