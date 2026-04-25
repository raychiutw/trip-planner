/**
 * functions/api/_session.ts unit test — V2-P1
 *
 * Integration of _cookies + src/server/session — wraps Pages Function-style helpers。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSessionUser,
  requireSessionUser,
  issueSession,
  clearSession,
} from '../../functions/api/_session';
import { signSessionToken } from '../../src/server/session';

const SECRET = 'test-session-secret';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-25T00:00:00Z'));
});

describe('getSessionUser', () => {
  it('returns null when no cookie', async () => {
    const req = new Request('https://x.com/api/foo');
    const result = await getSessionUser(req, { SESSION_SECRET: SECRET });
    expect(result).toBeNull();
  });

  it('returns null when cookie present but token invalid', async () => {
    const req = new Request('https://x.com/api/foo', {
      headers: { Cookie: 'tripline_session=invalid.token' },
    });
    const result = await getSessionUser(req, { SESSION_SECRET: SECRET });
    expect(result).toBeNull();
  });

  it('returns payload when cookie present and token valid', async () => {
    const token = await signSessionToken('user-1', SECRET);
    const req = new Request('https://x.com/api/foo', {
      headers: { Cookie: `tripline_session=${token}` },
    });
    const result = await getSessionUser(req, { SESSION_SECRET: SECRET });
    expect(result?.uid).toBe('user-1');
  });

  it('throws when SESSION_SECRET env missing AND cookie present', async () => {
    const req = new Request('https://x.com/api/foo', {
      headers: { Cookie: 'tripline_session=anything' },
    });
    await expect(getSessionUser(req, {})).rejects.toMatchObject({ code: 'SYS_INTERNAL' });
  });

  it('returns null without throwing when no cookie even if SESSION_SECRET missing', async () => {
    const req = new Request('https://x.com/api/foo');
    expect(await getSessionUser(req, {})).toBeNull();
  });
});

describe('requireSessionUser', () => {
  it('throws AUTH_REQUIRED when no session', async () => {
    const req = new Request('https://x.com/api/foo');
    await expect(requireSessionUser(req, { SESSION_SECRET: SECRET })).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('returns payload when session valid', async () => {
    const token = await signSessionToken('user-1', SECRET);
    const req = new Request('https://x.com/api/foo', {
      headers: { Cookie: `tripline_session=${token}` },
    });
    const result = await requireSessionUser(req, { SESSION_SECRET: SECRET });
    expect(result.uid).toBe('user-1');
  });
});

describe('issueSession', () => {
  it('appends Set-Cookie header with token + Secure (https)', async () => {
    const req = new Request('https://x.com/api/login');
    const res = new Response('ok');
    await issueSession(req, res, 'user-2', { SESSION_SECRET: SECRET });
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toMatch(/tripline_session=/);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');
  });

  it('http://localhost → no Secure attr', async () => {
    const req = new Request('http://localhost:8788/api/login');
    const res = new Response('ok');
    await issueSession(req, res, 'user-2', { SESSION_SECRET: SECRET });
    expect(res.headers.get('Set-Cookie')).not.toContain('Secure');
  });

  it('throws when SESSION_SECRET missing', async () => {
    const req = new Request('https://x.com/api/login');
    const res = new Response('ok');
    await expect(issueSession(req, res, 'u', {})).rejects.toMatchObject({ code: 'SYS_INTERNAL' });
  });
});

describe('clearSession', () => {
  it('appends Set-Cookie with Max-Age=0', () => {
    const req = new Request('https://x.com/api/logout');
    const res = new Response('ok');
    clearSession(req, res);
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toContain('Max-Age=0');
    expect(setCookie).toContain('Expires=Thu, 01 Jan 1970');
  });
});
