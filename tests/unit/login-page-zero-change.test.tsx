/**
 * LoginPage 零行為變更守門：重構（共用 classifyLoginError）後，各種錯誤的畫面與舊版逐項相同。
 * 舊版只看錯誤碼（LOGIN_INVALID／LOGIN_RATE_LIMITED），不看 HTTP 狀態碼；
 * 狀態碼補判是授權頁的規則，不可滲到這裡。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../../src/pages/LoginPage';

const fake = vi.hoisted(() => ({ login: vi.fn() }));

vi.mock('../../src/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/auth')>();
  return { ...actual, getNewApiAuth: () => ({ login: fake.login }), getNewApiBase: () => '' };
});

import { AuthError } from '../../src/lib/auth';

function submitWith(err: unknown) {
  fake.login.mockRejectedValue(err);
  render(<MemoryRouter initialEntries={['/login']}><LoginPage /></MemoryRouter>);
  fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'u@x.com' } });
  fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'pass1234' } });
  fireEvent.click(screen.getByTestId('login-submit'));
}
const banner = () => screen.findByTestId('login-banner-error');

beforeEach(() => { sessionStorage.clear(); fake.login.mockReset(); });
afterEach(() => sessionStorage.clear());

describe('LoginPage 錯誤處理與舊版逐項相同', () => {
  it('401 但錯誤碼未知 → 預設文案，不計失敗次數', async () => {
    submitWith(new AuthError('UNKNOWN', 'x', { status: 401 }));
    expect((await banner()).textContent).toContain('登入失敗，請稍後再試');
    expect(sessionStorage.getItem('tp_login_fail_count')).toBeNull();
  });

  it('429 但錯誤碼未知 → 預設文案，不進鎖定畫面', async () => {
    submitWith(new AuthError('UNKNOWN', 'x', { status: 429 }));
    expect((await banner()).textContent).toContain('登入失敗，請稍後再試');
    expect(screen.queryByTestId('login-page-locked')).toBeNull();
  });

  it('LOGIN_RATE_LIMITED 且 Retry-After 為 0 → 倒數 00:00（不是預設 30:00）', async () => {
    submitWith(new AuthError('LOGIN_RATE_LIMITED', 'x', { status: 429, retryAfter: 0 }));
    await waitFor(() => expect(screen.getByTestId('login-page-locked')).toBeTruthy());
    expect(screen.getByTestId('login-locked-countdown').textContent).toBe('00:00');
  });

  it('LOGIN_RATE_LIMITED 無 Retry-After → 預設 30:00', async () => {
    submitWith(new AuthError('LOGIN_RATE_LIMITED', 'x', { status: 429 }));
    await waitFor(() => expect(screen.getByTestId('login-page-locked')).toBeTruthy());
    expect(screen.getByTestId('login-locked-countdown').textContent).toBe('30:00');
  });

  it('LOGIN_INVALID_INPUT → 請輸入電子郵件與密碼', async () => {
    submitWith(new AuthError('LOGIN_INVALID_INPUT', 'x', { status: 400 }));
    expect((await banner()).textContent).toContain('請輸入電子郵件與密碼');
  });

  it('LOGIN_INVALID → 電子郵件或密碼錯誤並計失敗次數', async () => {
    submitWith(new AuthError('LOGIN_INVALID', 'x', { status: 401 }));
    expect((await banner()).textContent).toContain('電子郵件或密碼錯誤');
    expect(sessionStorage.getItem('tp_login_fail_count')).toBe('1');
  });

  it.each([
    ['AUTH_NETWORK', new AuthError('AUTH_NETWORK', 'net')],
    ['非 AuthError', new TypeError('Failed to fetch')],
  ])('%s → 網路連線失敗', async (_n, err) => {
    submitWith(err);
    expect((await banner()).textContent).toContain('網路連線失敗，請檢查後再試');
  });
});
