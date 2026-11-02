/**
 * Middleware companion gate (poi-favorites-rename §5.1)
 *
 * 端對端驗證：V2 Bearer token → middleware attaches auth.scopes / auth.clientId
 * → poi-favorites 的 companion 三 gate（X-Request-Scope header + scopes 含
 * 'companion' + clientId === env.TP_REQUEST_CLIENT_ID）。
 *
 *   case (a) 三條件全符合，但 2026-11-02 收窄後 /api/poi-favorites 不在白名單 → middleware 403
 *   case (b)(c) 已刪除：handler 的 companion gate 失敗路徑（self_reported_scope / client_unauthorized）
 *               被 middleware 擋在前面，無法經 HTTP 到達（見 PR 內文）
 *   case (d) 缺 header（X-Request-Scope）→ V2 user 路徑（無 user → 401，不寫 audit）
 *
 * 走 HTTP 邊界：真實 AccessToken row + 真實路由派送（middleware → handler → _companion），
 * 不再手寫 context 呼叫 onRequest / resolveCompanionUserId；結果改驗回應與真實 D1 的資料變化。
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, seedUser, seedTrip, seedPoi } from './helpers';
import { createApi, type Api } from './http';
import { serviceTokenFor } from './service-token';
import { cleanupTrips } from './cleanup-trips';

let db: D1Database;
let api: Api;
let submitterId: string;
let poiId: number;
const requestIds: number[] = [];

const TP_REQUEST_CLIENT_ID = 'tripline-internal-cli';
const SUBMITTER_EMAIL = 'companion-gate-submitter@test.com';
const TRIP_ID = 'companion-gate-trip-1';

beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db, { TP_REQUEST_CLIENT_ID }) });
  submitterId = await seedUser(db, SUBMITTER_EMAIL);
  await seedTrip(db, { id: TRIP_ID, owner: SUBMITTER_EMAIL });
  poiId = await seedPoi(db, { name: 'companion-gate-poi' });
});

beforeEach(async () => {
  await db.prepare('DELETE FROM poi_favorites WHERE user_id = ?').bind(submitterId).run();
});

afterAll(async () => {
  for (const id of requestIds) {
    await db.prepare('DELETE FROM companion_request_actions WHERE request_id = ?').bind(id).run();
    await db.prepare('DELETE FROM audit_log WHERE request_id = ?').bind(id).run();
    await db.prepare('DELETE FROM trip_requests WHERE id = ?').bind(id).run();
  }
  await db.prepare('DELETE FROM poi_favorites WHERE user_id = ?').bind(submitterId).run();
  await cleanupTrips(db, [TRIP_ID], ['companion-gate-poi']);
  await db.prepare('DELETE FROM users WHERE id = ?').bind(submitterId).run();
  await disposeMiniflare();
});

async function seedRequest(): Promise<number> {
  const row = await db
    .prepare(
      'INSERT INTO trip_requests (trip_id, message, submitted_by, status) VALUES (?, ?, ?, ?) RETURNING id',
    )
    .bind(TRIP_ID, 'gate test', SUBMITTER_EMAIL, 'processing')
    .first<{ id: number }>();
  requestIds.push(row!.id);
  return row!.id;
}

function postFavorite(token: string, requestId: number, withScopeHeader = true): Promise<Response> {
  return api.request('POST', 'https://test.com/api/poi-favorites', {
    bearer: token,
    headers: {
      ...(withScopeHeader ? { 'X-Request-Scope': 'companion' } : {}),
      Origin: 'https://trip-planner-dby.pages.dev',
    },
    json: { poiId, companionRequestId: requestId },
  });
}

async function failureReason(requestId: number): Promise<string | undefined> {
  const audit = await db
    .prepare(
      `SELECT companion_failure_reason FROM audit_log
       WHERE trip_id = 'system:companion' AND request_id = ? AND companion_failure_reason IS NOT NULL
       ORDER BY id DESC LIMIT 1`,
    )
    .bind(requestId)
    .first<{ companion_failure_reason: string }>();
  return audit?.companion_failure_reason;
}

async function favoritesOf(userId: string): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM poi_favorites WHERE user_id = ? AND poi_id = ? AND deleted_at IS NULL')
    .bind(userId, poiId)
    .first<{ n: number }>();
  return row!.n;
}

describe('middleware companion gate (§5.1)', () => {
  it('case (a) companion 三條件全符合，但 POST /api/poi-favorites 已移出白名單 → middleware 403 PERM_DENIED，不建立收藏（2026-11-02 收窄）', async () => {
    const token = await serviceTokenFor(db, { clientId: TP_REQUEST_CLIENT_ID, scopes: ['companion'] });
    const requestId = await seedRequest();

    const res = await postFavorite(token, requestId);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; detail: string } };
    expect(body.error.code).toBe('PERM_DENIED');
    expect(body.error.detail).toBe('此操作超出旅伴請求範圍');
    expect(await favoritesOf(submitterId)).toBe(0);
    // 被 gate 擋在 handler 之前：沒有 companion 稽核、沒有動作配額列
    expect(await failureReason(requestId)).toBeUndefined();
    const action = await db.prepare('SELECT 1 AS x FROM companion_request_actions WHERE request_id = ?').bind(requestId).first();
    expect(action).toBeNull();
  });

  it('case (d) 缺 X-Request-Scope header → 走 V2 user 路徑（服務 token 無 user → 401，不寫 audit）', async () => {
    const token = await serviceTokenFor(db, { clientId: TP_REQUEST_CLIENT_ID, scopes: ['companion'] });
    const requestId = await seedRequest();

    const res = await postFavorite(token, requestId, false);
    expect(res.status).toBe(401);

    const audit = await db
      .prepare(`SELECT id FROM audit_log WHERE trip_id = 'system:companion' AND request_id = ?`)
      .bind(requestId)
      .first();
    expect(audit).toBeNull();
    expect(await favoritesOf(submitterId)).toBe(0);
  });
});

/**
 * 2026-11-02 最小權限收窄：companion 白名單只剩 agent MCP 標為 companion 的 10 個工具。
 * 被移除的 10 項（trip-pois 寫入 3、PATCH requests、GET 3、收藏寫入 3）帶 companion header 一律
 * 403 PERM_DENIED「超出旅伴請求範圍」；保留的 10 項仍過 gate；同路徑沒帶 header 的一般請求不受影響。
 */
describe('companion 白名單最小權限（2026-11-02 收窄）', () => {
  const SCOPE_DETAIL = '此操作超出旅伴請求範圍';
  const ORIGIN = 'https://trip-planner-dby.pages.dev';

  const REMOVED: Array<[string, string]> = [
    ['POST', '/api/trips/t1/entries/1/trip-pois'],
    ['PATCH', '/api/trips/t1/trip-pois/5'],
    ['DELETE', '/api/trips/t1/trip-pois/5'],
    ['PATCH', '/api/requests/42'],
    ['GET', '/api/trips/t1/days/1'],
    ['GET', '/api/requests?tripId=t1'],
    ['GET', '/api/poi-favorites'],
    ['POST', '/api/poi-favorites'],
    ['DELETE', '/api/poi-favorites/7'],
    ['POST', '/api/poi-favorites/7/add-to-trip'],
  ];
  const KEPT: Array<[string, string]> = [
    ['POST', '/api/trips/t1/days/1/entries'],
    ['PATCH', '/api/trips/t1/entries/1'],
    ['POST', '/api/trips/t1/entries/1/alternates'],
    ['DELETE', '/api/trips/t1/entries/1/alternates/9'],
    ['PATCH', '/api/trips/t1/entries/1/alternates/reorder'],
    ['PATCH', '/api/trips/t1/entries/1/master'],
    ['PUT', '/api/trips/t1/entries/1/poi-id'],
    ['POST', '/api/trips/t1/recompute-travel'],
    ['POST', '/api/pois/123/enrich'],
    ['PATCH', '/api/pois/123'],
  ];

  async function call(method: string, path: string, companion: boolean) {
    const token = await serviceTokenFor(db, { clientId: TP_REQUEST_CLIENT_ID, scopes: ['companion'] });
    const res = await api.request(method, `https://test.com${path}`, {
      bearer: token,
      headers: { Origin: ORIGIN, ...(companion ? { 'X-Request-Scope': 'companion' } : {}) },
      json: method === 'GET' || method === 'DELETE' ? undefined : {},
    });
    const err = ((await res.json().catch(() => ({}))) as { error?: { code?: string; detail?: string } }).error;
    return { res, err };
  }

  it.each(REMOVED)('被移除：companion %s %s → 403 PERM_DENIED', async (method, path) => {
    const { res, err } = await call(method, path, true);
    expect(res.status).toBe(403);
    expect(err?.code).toBe('PERM_DENIED');
    expect(err?.detail).toBe(SCOPE_DETAIL);
  });

  it.each(KEPT)('保留：companion %s %s → 通過 gate', async (method, path) => {
    const { err } = await call(method, path, true);
    expect(err?.detail).not.toBe(SCOPE_DETAIL);
  });

  it.each(REMOVED)('一般請求不受影響：無 header %s %s → 不被 gate 擋', async (method, path) => {
    const { err } = await call(method, path, false);
    expect(err?.detail).not.toBe(SCOPE_DETAIL);
  });
});
