/**
 * Middleware companion whitelist for /api/poi-favorites (poi-favorites-rename §5.3)
 *
 * tp-request scheduler 持 companion scope 時，只能打白名單路徑。本 PR 把
 * `/api/saved-pois*` 4 條 pattern 改為 `/api/poi-favorites*`（hard cutover，不留
 * alias）。
 *
 * 4 條白名單：
 *   GET    /api/poi-favorites
 *   POST   /api/poi-favorites
 *   DELETE /api/poi-favorites/:id
 *   POST   /api/poi-favorites/:id/add-to-trip
 *
 * 走 HTTP 邊界：帶 X-Request-Scope: companion 發真實請求，看回應是否為「超出旅伴請求範圍」。
 * 沒有對應 route / method handler 的路徑（舊 saved-pois、GET /:id、PUT 列表），http.ts 的派送在進入
 * middleware 前就回 404/405，HTTP 邊界觀察不到 middleware 的決定，集中在檔尾直接呼叫（待 #1503）。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';
import { createApi, type Api } from './http';
import { checkCompanionScope } from '../../functions/api/_middleware';

const SCOPE_DETAIL = '此操作超出旅伴請求範圍';

let db: D1Database;
let api: Api;

beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db) });
});

afterAll(disposeMiniflare);

/** 該請求是否被 companion 白名單擋下（403 且 detail 為「超出旅伴請求範圍」）。 */
async function blocked(method: string, path: string): Promise<boolean> {
  const res = await api.request(method, `https://test.com${path}`, {
    headers: { 'X-Request-Scope': 'companion', Origin: 'https://trip-planner-dby.pages.dev' },
  });
  const err = ((await res.json().catch(() => ({}))) as { error?: { detail?: string } }).error;
  const isBlocked = res.status === 403 && err?.detail === SCOPE_DETAIL;
  if (!isBlocked) expect(err?.detail).not.toBe(SCOPE_DETAIL);
  return isBlocked;
}

describe('companion scope — /api/poi-favorites whitelist (§5.3)', () => {
  it('GET  /api/poi-favorites → 放行', async () => {
    expect(await blocked('GET', '/api/poi-favorites')).toBe(false);
  });

  it('POST /api/poi-favorites → 放行', async () => {
    expect(await blocked('POST', '/api/poi-favorites')).toBe(false);
  });

  it('DELETE /api/poi-favorites/123 → 放行', async () => {
    expect(await blocked('DELETE', '/api/poi-favorites/123')).toBe(false);
  });

  it('POST /api/poi-favorites/123/add-to-trip → 放行', async () => {
    expect(await blocked('POST', '/api/poi-favorites/123/add-to-trip')).toBe(false);
  });

  it('POST /api/poi-favorites/abc/add-to-trip → 403（id 必須是數字）', async () => {
    expect(await blocked('POST', '/api/poi-favorites/abc/add-to-trip')).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// 直接呼叫 checkCompanionScope（待 #1503）：下列路徑在 http.ts 派送裡沒有 route / method handler。
// ---------------------------------------------------------------------------------------------
describe('checkCompanionScope — HTTP 邊界到不了的 poi-favorites 路徑（直接呼叫，交給 #1503）', () => {
  function check(method: string, path: string, scope = 'companion') {
    const req = new Request(`https://test.com${path}`, {
      method,
      headers: scope ? { 'X-Request-Scope': scope } : {},
    });
    return checkCompanionScope(req, new URL(req.url));
  }

  it('GET  /api/poi-favorites/123 → 403（無 onRequestGet endpoint；CSO follow-up 收緊 whitelist）', () => {
    // [id]/index.ts 只 export onRequestDelete，沒 onRequestGet → 此 path 永遠 405。
    // 原 regex `/^\/api\/poi-favorites(\/\d+)?$/` over-eager 放行不存在的 endpoint，
    // 收緊為 `/^\/api\/poi-favorites$/`（list-only GET）— 避免無謂 attack surface。
    const resp = check('GET', '/api/poi-favorites/123');
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(403);
  });

  // hard cutover：舊 saved-pois 路徑不該再白名單
  it('POST /api/saved-pois → 403（舊路徑已 cutover）', () => {
    const resp = check('POST', '/api/saved-pois');
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(403);
  });

  it('DELETE /api/saved-pois/123 → 403（舊路徑已 cutover）', () => {
    expect(check('DELETE', '/api/saved-pois/123')!.status).toBe(403);
  });

  // 非白名單方法 → 403
  it('PUT /api/poi-favorites → 403（method 不在白名單）', () => {
    expect(check('PUT', '/api/poi-favorites')!.status).toBe(403);
  });
});
