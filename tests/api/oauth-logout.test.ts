/**
 * POST/GET /api/oauth/logout unit test — V2-P1 + V2-P6 audit
 */
import { describe, it, expect, vi } from 'vitest';
import { onRequestGet, onRequestPost } from '../../functions/api/oauth/logout';

function makeContext(
  url: string,
  method: 'GET' | 'POST' = 'GET',
  envOverride?: Record<string, unknown>,
  cookie?: string,
): Parameters<typeof onRequestGet>[0] {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  return {
    request: new Request(url, { method, headers }),
    env: (envOverride ?? {}) as unknown as never,
    params: {} as unknown as never,
    data: {} as unknown as never,
    next: () => Promise.resolve(new Response()),
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  } as unknown as Parameters<typeof onRequestGet>[0];
}

function makeAuditDb() {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  };
  const db = { prepare: vi.fn().mockReturnValue(stmt) };
  return { db, stmt };
}

describe('GET/POST /api/oauth/logout', () => {
  it('GET → 302 redirect to /login default + Set-Cookie Max-Age=0', async () => {
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/logout'));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login');
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toContain('tripline_session=');
    expect(setCookie).toContain('Max-Age=0');
    expect(setCookie).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('POST behaves identically to GET (clearSession + redirect)', async () => {
    const res = await onRequestPost(makeContext('https://x.com/api/oauth/logout', 'POST'));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login');
    expect(res.headers.get('Set-Cookie')).toMatch(/tripline_session=.*Max-Age=0/);
  });

  it('redirect_after preserves same-origin path', async () => {
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/logout?redirect_after=/explore'));
    expect(res.headers.get('Location')).toBe('/explore');
  });

  it('open redirect protection: //evil.com → fallback /login', async () => {
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/logout?redirect_after=//evil.com'));
    expect(res.headers.get('Location')).toBe('/login');
  });

  it('open redirect protection: absolute URL → fallback /login', async () => {
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/logout?redirect_after=https://evil.com'));
    expect(res.headers.get('Location')).toBe('/login');
  });

  it('http://localhost → no Secure cookie attr (local dev compat)', async () => {
    const res = await onRequestGet(makeContext('http://localhost:8788/api/oauth/logout'));
    expect(res.headers.get('Set-Cookie')).not.toContain('Secure');
  });

  it('https → Set-Cookie includes Secure', async () => {
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/logout'));
    expect(res.headers.get('Set-Cookie')).toContain('Secure');
  });

  it('records audit event with userId=null when no session cookie (V2-P6)', async () => {
    const { db, stmt } = makeAuditDb();
    await onRequestGet(makeContext('https://x.com/api/oauth/logout', 'GET', { DB: db }));
    // recordAuthEvent prepare called once for INSERT INTO auth_audit_log
    const auditCall = (db.prepare as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO auth_audit_log'),
    );
    expect(auditCall).toBeTruthy();
    const args = stmt.bind.mock.calls[0];
    expect(args[1]).toBe('logout');     // event_type
    expect(args[2]).toBe('success');    // outcome
    expect(args[3]).toBeNull();         // user_id (no session)
  });
});
