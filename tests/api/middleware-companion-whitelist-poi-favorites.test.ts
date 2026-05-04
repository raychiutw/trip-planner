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
 */
import { describe, it, expect } from 'vitest';
import { checkCompanionScope } from '../../functions/api/_middleware';

function check(method: string, path: string, scope = 'companion') {
  const req = new Request(`https://test.com${path}`, {
    method,
    headers: scope ? { 'X-Request-Scope': scope } : {},
  });
  return checkCompanionScope(req, new URL(req.url));
}

describe('checkCompanionScope — /api/poi-favorites whitelist (§5.3)', () => {
  it('GET  /api/poi-favorites → 放行', () => {
    expect(check('GET', '/api/poi-favorites')).toBeNull();
  });

  it('GET  /api/poi-favorites/123 → 放行（單筆讀取）', () => {
    expect(check('GET', '/api/poi-favorites/123')).toBeNull();
  });

  it('POST /api/poi-favorites → 放行', () => {
    expect(check('POST', '/api/poi-favorites')).toBeNull();
  });

  it('DELETE /api/poi-favorites/123 → 放行', () => {
    expect(check('DELETE', '/api/poi-favorites/123')).toBeNull();
  });

  it('POST /api/poi-favorites/123/add-to-trip → 放行', () => {
    expect(check('POST', '/api/poi-favorites/123/add-to-trip')).toBeNull();
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

  // 非白名單方法 / path → 403
  it('PUT /api/poi-favorites → 403（method 不在白名單）', () => {
    expect(check('PUT', '/api/poi-favorites')!.status).toBe(403);
  });

  it('POST /api/poi-favorites/abc/add-to-trip → 403（id 必須是數字）', () => {
    expect(check('POST', '/api/poi-favorites/abc/add-to-trip')!.status).toBe(403);
  });
});
