/**
 * 純函式測試 — _middleware.ts 的 exported 函式
 * isAllowedOrigin, checkCsrf, checkCompanionScope
 */
import { describe, it, expect } from 'vitest';
import { isAllowedOrigin, checkCsrf, checkCompanionScope } from '../../functions/api/_middleware';
import type { Env } from '../../functions/api/_types';

const baseEnv = {
  ADMIN_EMAIL: 'admin@test.com',
  ALLOWED_ORIGIN: '',
} as unknown as Env;

describe('isAllowedOrigin', () => {
  it('允許 production origin', () => {
    expect(isAllowedOrigin('https://trip-planner-dby.pages.dev', baseEnv)).toBe(true);
  });

  it('允許 localhost', () => {
    expect(isAllowedOrigin('http://localhost:5173', baseEnv)).toBe(true);
    expect(isAllowedOrigin('http://localhost', baseEnv)).toBe(true);
    expect(isAllowedOrigin('https://localhost:3000', baseEnv)).toBe(true);
  });

  it('允許 Pages preview deployment', () => {
    expect(isAllowedOrigin('https://abc123def.trip-planner-dby.pages.dev', baseEnv)).toBe(true);
  });

  it('拒絕不明 origin', () => {
    expect(isAllowedOrigin('https://evil.com', baseEnv)).toBe(false);
  });

  it('允許 ALLOWED_ORIGIN 自訂值', () => {
    const env = { ...baseEnv, ALLOWED_ORIGIN: 'https://custom.com, https://other.com' } as unknown as Env;
    expect(isAllowedOrigin('https://custom.com', env)).toBe(true);
    expect(isAllowedOrigin('https://other.com', env)).toBe(true);
    expect(isAllowedOrigin('https://nope.com', env)).toBe(false);
  });

  it('拒絕偽造 Pages preview（非 hex）', () => {
    expect(isAllowedOrigin('https://evil.trip-planner-dby.pages.dev', baseEnv)).toBe(false);
  });
});

describe('checkCsrf', () => {
  it('GET 請求直接放行', () => {
    const req = new Request('https://test.com/api/trips', { method: 'GET' });
    expect(checkCsrf(req, baseEnv)).toBeNull();
  });

  it('POST 有合法 Origin → 放行', () => {
    const req = new Request('https://test.com/api/trips', {
      method: 'POST',
      headers: { Origin: 'https://trip-planner-dby.pages.dev' },
    });
    expect(checkCsrf(req, baseEnv)).toBeNull();
  });

  it('POST 無 Origin 無 Service Token → 403', () => {
    const req = new Request('https://test.com/api/trips', { method: 'POST' });
    const resp = checkCsrf(req, baseEnv);
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(403);
  });

  it('POST 無 Origin 但有 Service Token → 放行', () => {
    const req = new Request('https://test.com/api/trips', {
      method: 'POST',
      headers: {
        'CF-Access-Client-Id': 'some-id',
        'CF-Access-Client-Secret': 'some-secret',
      },
    });
    expect(checkCsrf(req, baseEnv)).toBeNull();
  });

  it('POST 非法 Origin → 403', () => {
    const req = new Request('https://test.com/api/trips', {
      method: 'POST',
      headers: { Origin: 'https://evil.com' },
    });
    const resp = checkCsrf(req, baseEnv);
    expect(resp!.status).toBe(403);
  });

  it('DELETE 有合法 Origin → 放行', () => {
    const req = new Request('https://test.com/api/trips/1', {
      method: 'DELETE',
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(checkCsrf(req, baseEnv)).toBeNull();
  });
});

describe('checkCompanionScope', () => {
  function check(method: string, path: string, scope?: string) {
    const headers: Record<string, string> = {};
    if (scope) headers['X-Request-Scope'] = scope;
    const req = new Request(`https://test.com${path}`, { method, headers });
    const url = new URL(req.url);
    return checkCompanionScope(req, url);
  }

  it('無 scope header → 放行', () => {
    expect(check('DELETE', '/api/trips/test-trip')).toBeNull();
  });

  it('companion: PATCH entry → 放行', () => {
    expect(check('PATCH', '/api/trips/test-trip/entries/123', 'companion')).toBeNull();
  });

  it('companion: POST trip-pois → 放行', () => {
    expect(check('POST', '/api/trips/test-trip/entries/1/trip-pois', 'companion')).toBeNull();
  });

  it('companion: PATCH trip-pois → 放行', () => {
    expect(check('PATCH', '/api/trips/test-trip/trip-pois/5', 'companion')).toBeNull();
  });

  it('companion: DELETE trip-pois → 放行', () => {
    expect(check('DELETE', '/api/trips/test-trip/trip-pois/5', 'companion')).toBeNull();
  });

  it('companion: PUT docs → 放行', () => {
    expect(check('PUT', '/api/trips/test-trip/docs/flights', 'companion')).toBeNull();
  });

  it('companion: PATCH request → 放行', () => {
    expect(check('PATCH', '/api/requests/42', 'companion')).toBeNull();
  });

  it('companion: GET trips → 放行', () => {
    expect(check('GET', '/api/trips/test-trip/days/1', 'companion')).toBeNull();
  });

  it('companion: GET requests → 放行', () => {
    expect(check('GET', '/api/requests?tripId=test', 'companion')).toBeNull();
  });

  it('companion: PATCH pois → 放行', () => {
    expect(check('PATCH', '/api/pois/123', 'companion')).toBeNull();
  });

  // 白名單外 → 403
  it('companion: DELETE trip → 403', () => {
    const resp = check('DELETE', '/api/trips/test-trip', 'companion');
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(403);
  });

  it('companion: POST trips → 403', () => {
    expect(check('POST', '/api/trips', 'companion')!.status).toBe(403);
  });

  it('companion: GET permissions → 403', () => {
    expect(check('GET', '/api/permissions', 'companion')!.status).toBe(403);
  });

  it('companion: PUT days → 403', () => {
    expect(check('PUT', '/api/trips/test-trip/days/1', 'companion')!.status).toBe(403);
  });
});
