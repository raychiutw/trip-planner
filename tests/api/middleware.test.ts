/**
 * _middleware.ts 行為測試 — 走 HTTP 邊界（tests/api/http.ts）
 *
 * 原本直接呼叫 middleware 匯出的 isAllowedOrigin / checkCsrf / checkCompanionScope / detectSource。
 * 經真實路由派送時 middleware 本來就會跑，所以改成發真實請求、斷言回應與 api_logs 的資料變化：
 *   - isAllowedOrigin / checkCsrf：以 Origin 為唯一變因，看是否被 403（PERM_DENIED）擋下。
 *   - checkCompanionScope：帶 X-Request-Scope: companion，看回應是否為「超出旅伴請求範圍」。
 *   - detectSource：打一個必為 4xx 的請求，看 api_logs.source 欄位。
 *
 * http.ts 的派送先跑 middleware 再找 route，所以沒有對應 route / method handler 的路徑也看得到 middleware 的決定。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';
import { createApi, type Api } from './http';
import type { Env } from '../../functions/api/_types';

const BASE = 'https://test.com';
const PROD_ORIGIN = 'https://trip-planner-dby.pages.dev';
const SCOPE_DETAIL = '此操作超出旅伴請求範圍';

let db: D1Database;
let api: Api;
let previewApi: Api;
let customOriginApi: Api;

beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db, { ALLOWED_ORIGIN: '' } as Partial<Env>) });
  previewApi = createApi({ env: mockEnv(db, { ENVIRONMENT: 'preview' } as Partial<Env>) });
  customOriginApi = createApi({
    env: mockEnv(db, { ALLOWED_ORIGIN: 'https://custom.com, https://other.com' } as Partial<Env>),
  });
});

afterAll(async () => {
  await db.prepare("DELETE FROM api_logs WHERE path LIKE '/api/trips/mw-src-%'").run();
  await disposeMiniflare();
});

interface ErrBody { error?: { code?: string; detail?: string } }
async function errorOf(res: Response): Promise<ErrBody['error']> {
  return ((await res.json().catch(() => ({}))) as ErrBody).error;
}

/**
 * 以 Origin 為唯一變因探測 CSRF 判定：POST 公開端點 /api/reports 送空 body。
 * 通過 CSRF → 進 handler 驗證回 400；被擋 → 403 PERM_DENIED。
 */
async function originVerdict(target: Api, origin: string): Promise<'allowed' | 'blocked'> {
  const res = await target.request('POST', `${BASE}/api/reports`, { headers: { Origin: origin }, json: {} });
  const err = await errorOf(res);
  if (res.status === 403 && err?.code === 'PERM_DENIED') return 'blocked';
  expect(res.status).toBe(400); // 通過 CSRF 後才進到 handler 的欄位驗證
  return 'allowed';
}

describe('isAllowedOrigin（以 Origin 判定 CSRF 放行）', () => {
  it('允許 production origin', async () => {
    expect(await originVerdict(api, PROD_ORIGIN)).toBe('allowed');
  });

  it('允許 localhost', async () => {
    expect(await originVerdict(api, 'http://localhost:5173')).toBe('allowed');
    expect(await originVerdict(api, 'http://localhost')).toBe('allowed');
    expect(await originVerdict(api, 'https://localhost:3000')).toBe('allowed');
  });

  it('允許 Pages preview deployment（v2.33.62 round 14c: 需 env.ENVIRONMENT="preview" gate）', async () => {
    expect(await originVerdict(previewApi, 'https://abc123def.trip-planner-dby.pages.dev')).toBe('allowed');
    // 反向：prod 環境（無 ENVIRONMENT=preview）不該信任 preview origin
    expect(await originVerdict(api, 'https://abc123def.trip-planner-dby.pages.dev')).toBe('blocked');
  });

  it('拒絕不明 origin', async () => {
    expect(await originVerdict(api, 'https://evil.com')).toBe('blocked');
  });

  it('允許 ALLOWED_ORIGIN 自訂值', async () => {
    expect(await originVerdict(customOriginApi, 'https://custom.com')).toBe('allowed');
    expect(await originVerdict(customOriginApi, 'https://other.com')).toBe('allowed');
    expect(await originVerdict(customOriginApi, 'https://nope.com')).toBe('blocked');
  });

  it('拒絕偽造 Pages preview（非 hex）', async () => {
    expect(await originVerdict(api, 'https://evil.trip-planner-dby.pages.dev')).toBe('blocked');
    // 即使開了 preview 環境，非 hex 子網域一樣被擋
    expect(await originVerdict(previewApi, 'https://evil.trip-planner-dby.pages.dev')).toBe('blocked');
  });
});

describe('checkCsrf（變更類請求的 Origin 檢查）', () => {
  it('GET 請求直接放行（即使帶不明 Origin）', async () => {
    const res = await api.get(`${BASE}/api/health`, { headers: { Origin: 'https://evil.com' } });
    expect(res.status).toBe(200);
  });

  it('POST 有合法 Origin → 放行', async () => {
    expect(await originVerdict(api, PROD_ORIGIN)).toBe('allowed');
  });

  it('POST 無 Origin 無 Service Token → 403', async () => {
    const res = await api.request('POST', `${BASE}/api/reports`, { json: {} });
    expect(res.status).toBe(403);
    const err = await errorOf(res);
    expect(err?.code).toBe('PERM_DENIED');
    expect(err?.detail).toBe('Origin header required');
  });

  it('POST 無 Origin 但有 Service Token → 放行', async () => {
    const res = await api.request('POST', `${BASE}/api/reports`, {
      headers: { 'CF-Access-Client-Id': 'some-id', 'CF-Access-Client-Secret': 'some-secret' },
      json: {},
    });
    expect(res.status).toBe(400); // 過了 CSRF，進 handler 驗證
  });

  it('POST 非法 Origin → 403', async () => {
    const res = await api.request('POST', `${BASE}/api/reports`, { headers: { Origin: 'https://evil.com' }, json: {} });
    expect(res.status).toBe(403);
    expect((await errorOf(res))?.detail).toBe('Invalid origin');
  });

  it('DELETE 有合法 Origin → 放行（過了 CSRF，接著才因未登入回 401）', async () => {
    const res = await api.request('DELETE', `${BASE}/api/trips/mw-csrf-none`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(res.status).toBe(401);
    expect((await errorOf(res))?.code).toBe('AUTH_REQUIRED');
  });

  it('Bearer 請求帶不明 Origin → 403（v2.33.43：Bearer 不能直接跳過 CSRF）', async () => {
    const token = await api.tokenFor('mw-csrf-bearer@test.com');
    const res = await api.request('DELETE', `${BASE}/api/trips/mw-csrf-none`, {
      bearer: token,
      headers: { Origin: 'https://evil.com' },
    });
    expect(res.status).toBe(403);
    expect((await errorOf(res))?.detail).toBe('Invalid origin');
  });

  it('Bearer 請求沒帶 Origin（純 CLI / 排程）→ 放行', async () => {
    const token = await api.tokenFor('mw-csrf-bearer@test.com');
    const res = await api.request('DELETE', `${BASE}/api/trips/mw-csrf-none`, { bearer: token });
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(404); // 過了 CSRF，行程不存在
  });
});

describe('checkCompanionScope（X-Request-Scope: companion 的路徑白名單）', () => {
  /** 回傳該請求是否被 companion 白名單擋下（detail 為「超出旅伴請求範圍」）。 */
  async function blocked(method: string, path: string, scope?: string): Promise<boolean> {
    const headers: Record<string, string> = { Origin: PROD_ORIGIN };
    if (scope) headers['X-Request-Scope'] = scope;
    const res = await api.request(method, `${BASE}${path}`, { headers });
    const err = await errorOf(res);
    const isBlocked = res.status === 403 && err?.detail === SCOPE_DETAIL;
    if (!isBlocked) expect(err?.detail).not.toBe(SCOPE_DETAIL);
    return isBlocked;
  }
  const allowed = async (method: string, path: string) => expect(await blocked(method, path, 'companion')).toBe(false);
  const denied = async (method: string, path: string) => expect(await blocked(method, path, 'companion')).toBe(true);

  it('無 scope header → 放行', async () => {
    expect(await blocked('DELETE', '/api/trips/test-trip')).toBe(false);
  });

  it('companion: PATCH entry → 放行', () => allowed('PATCH', '/api/trips/test-trip/entries/123'));

  it('companion: POST trip-pois → 放行', () => allowed('POST', '/api/trips/test-trip/entries/1/trip-pois'));

  it('companion: PATCH request → 放行', () => allowed('PATCH', '/api/requests/42'));

  it('companion: GET trips → 放行', () => allowed('GET', '/api/trips/test-trip/days/1'));

  it('companion: GET requests → 放行', () => allowed('GET', '/api/requests?tripId=test'));

  it('companion: PATCH pois → 放行', () => allowed('PATCH', '/api/pois/123'));

  // v2.27.0+ entry-POI 主要 endpoints（tp-request containment 補齊；舊清單只有 legacy /trip-pois）
  it('companion: POST alternates → 放行', () => allowed('POST', '/api/trips/test-trip/entries/1/alternates'));

  it('companion: DELETE alternate → 放行', () => allowed('DELETE', '/api/trips/test-trip/entries/1/alternates/9'));

  it('companion: PATCH alternates/reorder → 放行', () => allowed('PATCH', '/api/trips/test-trip/entries/1/alternates/reorder'));

  it('companion: PATCH master → 放行', () => allowed('PATCH', '/api/trips/test-trip/entries/1/master'));

  it('companion: PUT poi-id → 放行', () => allowed('PUT', '/api/trips/test-trip/entries/1/poi-id'));

  it('companion: POST recompute-travel → 放行', () => allowed('POST', '/api/trips/test-trip/recompute-travel'));

  it('companion: POST pois enrich → 放行', () => allowed('POST', '/api/pois/123/enrich'));

  // 白名單外 → 403
  it('companion: DELETE entry（非 alternate）→ 403', () =>
    // 補齊 alternates 白名單後，確認「整個 entry 刪除」仍被擋（❌ 硬限制）
    denied('DELETE', '/api/trips/test-trip/entries/1'));

  it('companion: DELETE trip → 403', () => denied('DELETE', '/api/trips/test-trip'));

  it('companion: POST trips → 403', () => denied('POST', '/api/trips'));

  it('companion: GET permissions → 403', () => denied('GET', '/api/permissions'));

  it('companion: PUT days → 403', () => denied('PUT', '/api/trips/test-trip/days/1'));

  it('companion: PATCH trip-pois → 放行', () => allowed('PATCH', '/api/trips/test-trip/trip-pois/5'));

  it('companion: DELETE trip-pois → 放行', () => allowed('DELETE', '/api/trips/test-trip/trip-pois/5'));

  // 2026-07-28：trip_docs 整條退役（前端不 fetch /docs，checklist/emergency 的 UI
  // 入口 v2.17.17 就移除）。留著這條 companion 放行，agent 想寫行程筆記時就會倒進
  // 這個黑洞 —— prod request 280 正是這樣寫了四次空內容還回報成功。
  // 唯一的消費者是 MCP 的 putDoc 工具，已一併移除。
  it('companion: PUT docs → 擋（trip_docs 已退役，不給 agent 寫）', () =>
    denied('PUT', '/api/trips/test-trip/docs/flights'));
});

describe('detectSource（api_logs.source 的來源分類）', () => {
  let seq = 0;
  /** 對一個必為 4xx 的唯一路徑發請求，回傳 middleware 寫進 api_logs 的 source（沒寫＝null）。 */
  async function loggedSource(headers: Record<string, string>): Promise<string | null> {
    const path = `/api/trips/mw-src-${Date.now()}-${seq++}/days`;
    const res = await api.get(`${BASE}${path}`, { headers });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const row = await db
      .prepare('SELECT source FROM api_logs WHERE path = ? ORDER BY id DESC LIMIT 1')
      .bind(path)
      .first<{ source: string }>();
    return row?.source ?? null;
  }

  it('scheduler: X-Tripline-Source header → scheduler', async () => {
    expect(await loggedSource({ 'X-Tripline-Source': 'scheduler' })).toBe('scheduler');
  });

  it('scheduler 優先於 service_token（同時帶兩個 header）', async () => {
    expect(await loggedSource({
      'X-Tripline-Source': 'scheduler',
      'CF-Access-Client-Id': 'id',
      'CF-Access-Client-Secret': 'secret',
    })).toBe('scheduler');
  });

  it('companion: X-Request-Scope=companion → companion', async () => {
    expect(await loggedSource({ 'X-Request-Scope': 'companion' })).toBe('companion');
  });

  it('companion 優先於 service_token', async () => {
    expect(await loggedSource({
      'X-Request-Scope': 'companion',
      'CF-Access-Client-Id': 'id',
      'CF-Access-Client-Secret': 'secret',
    })).toBe('companion');
  });

  it('service_token: 只有 CF-Access-Client-Id + Secret → service_token', async () => {
    expect(await loggedSource({ 'CF-Access-Client-Id': 'id', 'CF-Access-Client-Secret': 'secret' })).toBe('service_token');
  });

  it('service_token: 只有 Client-Id 沒 Secret → 不算 service_token（anonymous，4xx 不寫 log）', async () => {
    expect(await loggedSource({ 'CF-Access-Client-Id': 'id' })).toBeNull();
  });

  it('user_jwt: CF_Authorization cookie → user_jwt', async () => {
    expect(await loggedSource({ Cookie: 'CF_Authorization=eyJhbGciOiJIUzI1NiJ9.abc.sig' })).toBe('user_jwt');
  });

  it('anonymous: 完全沒帶任何 auth → anonymous（4xx 屬 bot 雜訊，不寫 log）', async () => {
    expect(await loggedSource({})).toBeNull();
  });
});
