/**
 * classifyLoginError：LoginPage 與授權頁共用的登入錯誤分類（文案各頁自配，不在這裡）。
 */
import { describe, it, expect } from 'vitest';
import { AuthError } from '../../src/lib/auth';
import { classifyLoginError } from '../../src/lib/auth/loginError';

describe('classifyLoginError', () => {
  it.each([
    ['LOGIN_INVALID（401）', new AuthError('LOGIN_INVALID', 'x', { status: 401 }), { kind: 'invalid' }],
    ['LOGIN_INVALID（無 status）', new AuthError('LOGIN_INVALID', 'x'), { kind: 'invalid' }],
    ['401 但 code 未知', new AuthError('UNKNOWN', 'x', { status: 401 }), { kind: 'invalid' }],
    ['LOGIN_RATE_LIMITED 帶 Retry-After', new AuthError('LOGIN_RATE_LIMITED', 'x', { status: 429, retryAfter: 120 }), { kind: 'rate-limited', retryAfter: 120 }],
    ['LOGIN_RATE_LIMITED 無 Retry-After', new AuthError('LOGIN_RATE_LIMITED', 'x'), { kind: 'rate-limited', retryAfter: undefined }],
    ['429 但 code 未知', new AuthError('UNKNOWN', 'x', { status: 429 }), { kind: 'rate-limited', retryAfter: undefined }],
    ['AUTH_NETWORK', new AuthError('AUTH_NETWORK', 'net'), { kind: 'network' }],
    ['非 AuthError（fetch 丟 TypeError）', new TypeError('Failed to fetch'), { kind: 'network' }],
    ['5xx', new AuthError('SERVER_BOOM', 'x', { status: 500 }), { kind: 'other', code: 'SERVER_BOOM' }],
    ['LOGIN_INVALID_INPUT 屬 other（登入頁自己配文案）', new AuthError('LOGIN_INVALID_INPUT', 'x', { status: 400 }), { kind: 'other', code: 'LOGIN_INVALID_INPUT' }],
  ])('%s', (_name, err, expected) => {
    expect(classifyLoginError(err)).toEqual(expected);
  });

  it('statusFallback: false → 只認錯誤碼，401／429 未知碼歸 other（LoginPage 用）', () => {
    const off = { statusFallback: false };
    expect(classifyLoginError(new AuthError('UNKNOWN', 'x', { status: 401 }), off)).toEqual({ kind: 'other', code: 'UNKNOWN' });
    expect(classifyLoginError(new AuthError('UNKNOWN', 'x', { status: 429 }), off)).toEqual({ kind: 'other', code: 'UNKNOWN' });
    expect(classifyLoginError(new AuthError('LOGIN_INVALID', 'x', { status: 401 }), off)).toEqual({ kind: 'invalid' });
  });
});
