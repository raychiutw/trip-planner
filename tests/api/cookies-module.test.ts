/**
 * functions/api/_cookies.ts unit test — V2-P1
 */
import { describe, it, expect } from 'vitest';
import {
  getSessionCookie,
  buildSessionSetCookie,
  buildClearSessionSetCookie,
  shouldSetSecure,
} from '../../functions/api/_cookies';

describe('getSessionCookie', () => {
  it('returns null when no Cookie header', () => {
    const req = new Request('https://x.com');
    expect(getSessionCookie(req)).toBeNull();
  });

  it('returns null when Cookie header empty', () => {
    const req = new Request('https://x.com', { headers: { Cookie: '' } });
    expect(getSessionCookie(req)).toBeNull();
  });

  it('returns null when no tripline_session in Cookie', () => {
    const req = new Request('https://x.com', { headers: { Cookie: 'foo=bar; baz=qux' } });
    expect(getSessionCookie(req)).toBeNull();
  });

  it('returns token value when present', () => {
    const req = new Request('https://x.com', {
      headers: { Cookie: 'foo=bar; tripline_session=eyJhbGc.signature; baz=qux' },
    });
    expect(getSessionCookie(req)).toBe('eyJhbGc.signature');
  });

  it('handles cookie value with = inside (base64url 不會但 future-proof)', () => {
    const req = new Request('https://x.com', {
      headers: { Cookie: 'tripline_session=a=b=c' },
    });
    expect(getSessionCookie(req)).toBe('a=b=c');
  });

  it('trims whitespace around key', () => {
    const req = new Request('https://x.com', {
      headers: { Cookie: 'foo=1; tripline_session=token' },
    });
    expect(getSessionCookie(req)).toBe('token');
  });
});

describe('buildSessionSetCookie', () => {
  it('default attributes: HttpOnly + SameSite=Lax + Path=/ + Secure + Max-Age 30d', () => {
    const cookie = buildSessionSetCookie('mytoken');
    expect(cookie).toContain('tripline_session=mytoken');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('Max-Age=2592000'); // 30 * 24 * 60 * 60
  });

  it('secure: false 不含 Secure（local dev http）', () => {
    const cookie = buildSessionSetCookie('t', { secure: false });
    expect(cookie).not.toContain('Secure');
    expect(cookie).toContain('HttpOnly'); // 其他 attr 仍在
  });

  it('custom maxAge respected', () => {
    const cookie = buildSessionSetCookie('t', { maxAge: 600 });
    expect(cookie).toContain('Max-Age=600');
  });
});

describe('buildClearSessionSetCookie', () => {
  it('Max-Age=0 + Expires past + empty value', () => {
    const cookie = buildClearSessionSetCookie();
    expect(cookie).toContain('tripline_session=');
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('Expires=Thu, 01 Jan 1970');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
  });

  it('secure: false 不含 Secure', () => {
    const cookie = buildClearSessionSetCookie(false);
    expect(cookie).not.toContain('Secure');
  });
});

describe('shouldSetSecure', () => {
  it('https request → true', () => {
    expect(shouldSetSecure(new Request('https://x.com/api/foo'))).toBe(true);
  });

  it('http request → false (local dev)', () => {
    expect(shouldSetSecure(new Request('http://localhost:8788/api/foo'))).toBe(false);
  });
});
