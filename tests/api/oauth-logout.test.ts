/**
 * POST/GET /api/oauth/logout — V2-P1 + V2-P6 audit
 * 走 HTTP 邊界（tests/api/http.ts）；稽核事件改驗真實 D1 的資料變化，不看 mock 呼叫形狀。
 * 部分斷言取決於請求的 origin（Secure cookie），所以用絕對網址，僅適用進程內目標。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';
import { createApi, type Api } from './http';

let db: D1Database;
let api: Api;

beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db) });
});

afterAll(disposeMiniflare);

describe('GET/POST /api/oauth/logout', () => {
  it('GET → 302 redirect to /login default + Set-Cookie Max-Age=0', async () => {
    const res = await api.get('https://x.com/api/oauth/logout');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login');
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toContain('tripline_session=');
    expect(setCookie).toContain('Max-Age=0');
    expect(setCookie).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('POST behaves identically to GET (clearSession + redirect)', async () => {
    const res = await api.request('POST', 'https://x.com/api/oauth/logout');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login');
    expect(res.headers.get('Set-Cookie')).toMatch(/tripline_session=.*Max-Age=0/);
  });

  it('redirect_after preserves same-origin path', async () => {
    const res = await api.get('https://x.com/api/oauth/logout?redirect_after=/explore');
    expect(res.headers.get('Location')).toBe('/explore');
  });

  it('open redirect protection: //evil.com → fallback /login', async () => {
    const res = await api.get('https://x.com/api/oauth/logout?redirect_after=//evil.com');
    expect(res.headers.get('Location')).toBe('/login');
  });

  it('open redirect protection: absolute URL → fallback /login', async () => {
    const res = await api.get('https://x.com/api/oauth/logout?redirect_after=https://evil.com');
    expect(res.headers.get('Location')).toBe('/login');
  });

  it('http://localhost → no Secure cookie attr (local dev compat)', async () => {
    const res = await api.get('http://localhost:8788/api/oauth/logout');
    expect(res.headers.get('Set-Cookie')).not.toContain('Secure');
  });

  it('https → Set-Cookie includes Secure', async () => {
    const res = await api.get('https://x.com/api/oauth/logout');
    expect(res.headers.get('Set-Cookie')).toContain('Secure');
  });

  it('records audit event with userId=null when no session cookie (V2-P6)', async () => {
    const before = await db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM auth_audit_log').first<{ m: number }>();
    await api.get('https://x.com/api/oauth/logout');
    const { results } = await db
      .prepare('SELECT event_type, outcome, user_id FROM auth_audit_log WHERE id > ? ORDER BY id')
      .bind(before!.m)
      .all<{ event_type: string; outcome: string; user_id: string | null }>();
    expect(results).toEqual([{ event_type: 'logout', outcome: 'success', user_id: null }]);
  });
});
