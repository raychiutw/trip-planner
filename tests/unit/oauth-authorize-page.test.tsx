/**
 * /oauth/authorize —— 新 api 的第一方 App「瀏覽器登入」授權頁（設計稿 C：帳號晶片＋單一按鈕）。
 * 只測呈現與無障礙（流程見 use-authorize-flow.test.tsx）。走 auth client 的邊界（login／restoreSession／apiFetch／logout 以 fake 取代）；頁面對新 api 的三個呼叫：
 *   GET  /api/oauth/authorize/requests/:id        → { client:{app_name}, scopes, needs_consent }
 *   GET  /api/oauth/userinfo                      → { email }
 *   POST /api/oauth/authorize/requests/:id/approve → { redirect_to }
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const fake = vi.hoisted(() => ({
  state: { authed: false, restoreOk: false, loginError: null as null | { code: string } },
  login: vi.fn(),
  restoreSession: vi.fn(),
  logout: vi.fn(),
  apiFetch: vi.fn(),
  isAuthenticated: vi.fn(),
  getAuthorizeAuth: vi.fn(),
}));

vi.mock('../../src/lib/auth', async (orig) => {
  const m = await orig<typeof import('../../src/lib/auth')>();
  return { ...m, getAuthorizeAuth: fake.getAuthorizeAuth };
});

import OauthAuthorizePage from '../../src/pages/OauthAuthorizePage';
import { AuthError } from '../../src/lib/auth';

const REQ = {
  client: { client_id: 'tripline-mobile', app_name: 'Tripline' },
  scopes: ['openid', 'profile', 'email', 'offline_access'],
  needs_consent: true,
  expires_at: '2099-01-01T00:00:00.000Z',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let assign: ReturnType<typeof vi.fn>;

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/oauth/authorize${search}`]}>
      <OauthAuthorizePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fake.state.authed = false;
  fake.state.restoreOk = false;
  fake.state.loginError = null;
  fake.login.mockReset().mockImplementation(async () => {
    if (fake.state.loginError) throw new AuthError(fake.state.loginError.code, 'x', { status: 401 });
    fake.state.authed = true;
  });
  fake.restoreSession.mockReset().mockImplementation(async () => {
    if (fake.state.restoreOk) fake.state.authed = true;
    return fake.state.restoreOk;
  });
  fake.logout.mockReset().mockImplementation(async () => { fake.state.authed = false; });
  fake.isAuthenticated.mockReset().mockImplementation(() => fake.state.authed);
  fake.apiFetch.mockReset().mockImplementation(async (input: string, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/oauth/userinfo')) return json({ email: 'ray@example.com' });
    if (url.endsWith('/approve') && init?.method === 'POST') return json({ redirect_to: 'https://trip-planner-dby.pages.dev/mobile/oauth/callback?code=abc&state=st1' });
    if (url.includes('/api/oauth/authorize/requests/')) return json(REQ);
    return json({ error: { code: 'NOT_FOUND', message: 'x' } }, 404);
  });
  fake.getAuthorizeAuth.mockReset().mockReturnValue({
    login: fake.login, restoreSession: fake.restoreSession, logout: fake.logout,
    apiFetch: fake.apiFetch, isAuthenticated: fake.isAuthenticated, refresh: vi.fn(), getIdToken: () => null,
  });
  assign = vi.fn();
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign } });
});
afterEach(cleanup);

describe('錯誤畫面', () => {
  it('授權連結不完整 → 顯示錯誤橫幅（流程判斷見 use-authorize-flow.test）', async () => {
    renderAt('');
    expect(await screen.findByTestId('authz-error')).toBeTruthy();
  });

  it('一般 403 PERM_DENIED → 顯示權限說明，不是「請求已過期」', async () => {
    fake.state.restoreOk = true;
    const base = fake.apiFetch.getMockImplementation()!;
    fake.apiFetch.mockImplementation(async (input: string, init?: RequestInit) =>
      String(input).endsWith('/approve') ? json({ error: { code: 'PERM_DENIED', message: 'x' } }, 403) : base(input, init));
    renderAt('?request_id=req1');
    fireEvent.click(await screen.findByTestId('authz-continue'));
    const err = await screen.findByTestId('authz-error');
    expect(err.textContent).toContain('沒有權限完成這次授權');
    expect(err.textContent).not.toContain('請求已過期');
  });
});

describe('未登入', () => {
  it('密碼錯誤 → 兩欄標為無效並指向有文字的錯誤元素；無錯時屬性不存在（#1561）', async () => {
    fake.state.loginError = { code: 'LOGIN_INVALID' };
    renderAt('?request_id=req1');
    const email = await screen.findByTestId('authz-email');
    const password = screen.getByTestId('authz-password');
    for (const el of [email, password]) {
      expect(el.hasAttribute('aria-invalid')).toBe(false);
      expect(el.hasAttribute('aria-describedby')).toBe(false);
    }
    fireEvent.change(email, { target: { value: 'ray@example.com' } });
    fireEvent.change(password, { target: { value: 'bad' } });
    fireEvent.click(screen.getByTestId('authz-login-submit'));
    await screen.findByTestId('authz-login-error');
    for (const el of [screen.getByTestId('authz-email'), screen.getByTestId('authz-password')]) {
      expect(el.getAttribute('aria-invalid')).toBe('true');
      const target = document.getElementById(el.getAttribute('aria-describedby')!);
      expect(target?.textContent).toContain('電子郵件或密碼錯誤');
      expect(target?.closest('[role="alert"]')).toBeTruthy();
    }
  });

  it('非帳密問題（登入失敗稍後再試）→ 不標無效（#1561）', async () => {
    fake.state.loginError = { code: 'SERVER_BOOM' };
    fake.login.mockImplementation(async () => { throw new AuthError('SERVER_BOOM', 'x', { status: 500 }); });
    renderAt('?request_id=req1');
    fireEvent.change(await screen.findByTestId('authz-email'), { target: { value: 'ray@example.com' } });
    fireEvent.change(screen.getByTestId('authz-password'), { target: { value: 'x' } });
    fireEvent.click(screen.getByTestId('authz-login-submit'));
    await screen.findByTestId('authz-login-error');
    expect(screen.getByTestId('authz-password').hasAttribute('aria-invalid')).toBe(false);
  });
});

describe('已登入', () => {
  beforeEach(() => { fake.state.restoreOk = true; });

  it('還原登入成功 → 直接顯示確認（不顯示登入表單），權限收在可展開區', async () => {
    renderAt('?request_id=req1');
    await screen.findByTestId('authz-continue');
    expect(screen.queryByTestId('authz-login-form')).toBeNull();
    expect(screen.getByTestId('authz-scopes').textContent).toContain('基本資料');
    expect(screen.getByTestId('authz-app-name').textContent).toContain('Tripline');
  });

  it('按「繼續」→ POST approve，並導向 api 回傳的 redirect_to', async () => {
    renderAt('?request_id=req1');
    fireEvent.click(await screen.findByTestId('authz-continue'));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://trip-planner-dby.pages.dev/mobile/oauth/callback?code=abc&state=st1'));
    const post = fake.apiFetch.mock.calls.find(([u]) => String(u).endsWith('/approve'));
    expect(post?.[0]).toBe('/api/oauth/authorize/requests/req1/approve');
    expect((post?.[1] as RequestInit).method).toBe('POST');
  });

  it('「使用其他帳號」→ 登出本機憑證並回到登入表單', async () => {
    renderAt('?request_id=req1');
    fireEvent.click(await screen.findByTestId('authz-switch-account'));
    expect(await screen.findByTestId('authz-login-form')).toBeTruthy();
    expect(fake.logout).toHaveBeenCalledTimes(1);
  });

});

describe('授權頁登入表單密碼顯示切換（#1560）', () => {
  it('切換前後 input type 與 aria-pressed 正確，autoComplete 不變', async () => {
    renderAt('?request_id=req1');
    const input = (await screen.findByTestId('authz-password')) as HTMLInputElement;
    const toggle = screen.getByRole('button', { name: '顯示密碼' });
    expect(input.type).toBe('password');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '顯示密碼' })).toBe(toggle);
    expect(toggle.getAttribute('type')).toBe('button');
    expect(toggle.classList.contains('tp-pw-toggle')).toBe(true);
    expect(input.type).toBe('text');
    expect(input.getAttribute('autocomplete')).toBe('current-password');
    expect(fake.login).not.toHaveBeenCalled();
  });
});

describe('生物辨識專門鈕（#1724，ADR-0018）', () => {
  const bioBtn = () => screen.queryByTestId('authz-bio-login');
  const fillAndClick = async (testId: string) => {
    fireEvent.change(await screen.findByTestId('authz-email'), { target: { value: 'ray@example.com' } });
    fireEvent.change(screen.getByTestId('authz-password'), { target: { value: 'pw-pw-pw-pw' } });
    fireEvent.click(screen.getByTestId(testId));
  };
  const calls = () => fake.apiFetch.mock.calls.map(([u]) => String(u));

  it('沒有 biometric_hint → 完全不顯示專門鈕', async () => {
    renderAt('?request_id=req1');
    await screen.findByTestId('authz-login-form');
    expect(bioBtn()).toBeNull();
  });

  it('biometric_hint 不是白名單值 → 不顯示專門鈕', async () => {
    renderAt('?request_id=req1&biometric_hint=retina');
    await screen.findByTestId('authz-login-form');
    expect(bioBtn()).toBeNull();
  });

  it.each([
    ['faceid', '用 Face ID 登入'],
    ['touchid', '用 Touch ID 登入'],
    ['generic', '用生物辨識登入'],
  ])('biometric_hint=%s → 顯示「%s」', async (hint, label) => {
    renderAt(`?request_id=req1&biometric_hint=${hint}`);
    await screen.findByTestId('authz-login-form');
    expect(bioBtn()?.textContent).toContain(label);
  });

  it('帳密未填就按專門鈕 → 就地顯示必填錯誤，不送出登入', async () => {
    renderAt('?request_id=req1&biometric_hint=faceid');
    fireEvent.click(await screen.findByTestId('authz-bio-login'));
    expect(await screen.findByTestId('authz-bio-required')).toBeTruthy();
    expect(fake.login).not.toHaveBeenCalled();
  });

  it('帳密未填的錯誤連到欄位（aria-describedby），焦點移到第一個空欄位', async () => {
    renderAt('?request_id=req1&biometric_hint=faceid');
    fireEvent.click(await screen.findByTestId('authz-bio-login'));
    const err = await screen.findByTestId('authz-bio-required');
    expect(err.id).toBe('authz-bio-required');
    const email = screen.getByTestId('authz-email');
    const password = screen.getByTestId('authz-password');
    expect(email.getAttribute('aria-describedby')).toBe('authz-bio-required');
    expect(password.getAttribute('aria-describedby')).toBe('authz-bio-required');
    expect(document.activeElement).toBe(email);
    // 只缺密碼時，焦點到密碼欄
    fireEvent.change(email, { target: { value: 'ray@example.com' } });
    fireEvent.click(screen.getByTestId('authz-bio-login'));
    await waitFor(() => expect(document.activeElement).toBe(password));
  });

  // 以下兩則只守「哪顆鈕帶 enableBio」的接線；意圖的順序、內容與重試見 use-authorize-flow／authorize-approve 測試
  it('按專門鈕登入 → 繼續時會送 intent(enable)（接線）', async () => {
    renderAt('?request_id=req1&biometric_hint=faceid');
    await fillAndClick('authz-bio-login');
    fireEvent.click(await screen.findByTestId('authz-continue'));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(calls().some((u) => u.endsWith('/intent'))).toBe(true);
  });

  it('按一般登入鈕 → 即使有專門鈕也不呼叫 intent', async () => {
    renderAt('?request_id=req1&biometric_hint=faceid');
    await fillAndClick('authz-login-submit');
    fireEvent.click(await screen.findByTestId('authz-continue'));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(calls().some((u) => u.endsWith('/intent'))).toBe(false);
  });
});

describe('重新驗證模式（#1725，reauth=enable|disable|login）呈現', () => {
  it.each([
    ['enable', '開啟生物辨識登入，請重新輸入密碼'],
    ['disable', '關閉生物辨識登入，請重新輸入密碼'],
    ['login', '請重新輸入密碼登入'],
  ])('reauth=%s → 顯示登入表單與文案，不顯示「繼續」', async (v, text) => {
    renderAt(`?request_id=req1&reauth=${v}`);
    expect(await screen.findByTestId('authz-login-form')).toBeTruthy();
    expect(document.body.textContent).toContain(text);
    expect(screen.queryByTestId('authz-continue')).toBeNull();
  });

  it('reauth 值不在白名單 → 當作一般授權（會還原登入）', async () => {
    fake.state.restoreOk = true;
    renderAt('?request_id=req1&reauth=bogus');
    await screen.findByTestId('authz-continue');
    expect(fake.restoreSession).toHaveBeenCalled();
  });

  it.each(['enable', 'login'])('reauth=%s → 不顯示專門鈕', async (v) => {
    renderAt(`?request_id=req1&reauth=${v}&biometric_hint=faceid`);
    await screen.findByTestId('authz-login-form');
    expect(screen.queryByTestId('authz-bio-login')).toBeNull();
  });

  it('一般授權的登入表單沒有 reauth 文案', async () => {
    renderAt('?request_id=req1');
    expect(await screen.findByTestId('authz-login-form')).toBeTruthy();
    expect(document.body.textContent).not.toContain('請重新輸入密碼');
  });
});
