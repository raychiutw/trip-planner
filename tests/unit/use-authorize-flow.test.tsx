/**
 * useAuthorizeFlow：授權頁流程（view 狀態機、登入、wantBio、批准、兩種 403 分支、防重入）。
 * seam 是 getAuthorizeAuth()（login／restoreSession／apiFetch／logout 以 fake 取代）；畫面呈現見 oauth-authorize-page.test.tsx。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const fake = vi.hoisted(() => ({
  state: { authed: false, restoreOk: false },
  login: vi.fn(), restoreSession: vi.fn(), logout: vi.fn(), apiFetch: vi.fn(), isAuthenticated: vi.fn(), getAuthorizeAuth: vi.fn(),
}));

vi.mock('../../src/lib/auth', async (orig) => ({ ...(await orig<typeof import('../../src/lib/auth')>()), getAuthorizeAuth: fake.getAuthorizeAuth }));

import { useAuthorizeFlow } from '../../src/hooks/useAuthorizeFlow';
import { AuthError } from '../../src/lib/auth';
import type { ReauthValue } from '../../src/lib/auth/authorizeContract';

const CB = 'https://trip-planner-dby.pages.dev/mobile/oauth/callback?code=abc&state=st1';
const REQ = { client: { client_id: 'tripline-mobile', app_name: 'Tripline' }, scopes: ['openid', 'profile'], needs_consent: true };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const calls = () => fake.apiFetch.mock.calls.map(([u]) => String(u));
const count = (suffix: string) => calls().filter((u) => u.endsWith(suffix)).length;
const forbidden = (code: string) => json({ error: { code, message: 'x' } }, 403);

let assign: ReturnType<typeof vi.fn>;
let approveRes: () => Response;

function start(opts: { requestId?: string; reauth?: ReauthValue | null } = {}) {
  return renderHook(() => useAuthorizeFlow({ requestId: opts.requestId ?? 'req1', reauth: opts.reauth ?? null }));
}

beforeEach(() => {
  fake.state.authed = false;
  fake.state.restoreOk = false;
  approveRes = () => json({ redirect_to: CB });
  fake.login.mockReset().mockImplementation(async () => { fake.state.authed = true; });
  fake.restoreSession.mockReset().mockImplementation(async () => fake.state.restoreOk);
  fake.logout.mockReset().mockImplementation(async () => { fake.state.authed = false; });
  fake.isAuthenticated.mockReset().mockImplementation(() => fake.state.authed);
  fake.apiFetch.mockReset().mockImplementation(async (input: string, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/oauth/userinfo')) return json({ email: 'ray@example.com' });
    if (url.endsWith('/approve') && init?.method === 'POST') return approveRes();
    if (url.endsWith('/intent')) return new Response(null, { status: 204 });
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
afterEach(() => { vi.useRealTimers(); });

describe('初始化', () => {
  it('request_id 不合法 → error，不呼叫任何 API', async () => {
    const { result } = start({ requestId: '../../etc' });
    await waitFor(() => expect(result.current.view.kind).toBe('error'));
    expect(fake.apiFetch).not.toHaveBeenCalled();
    expect(fake.restoreSession).not.toHaveBeenCalled();
  });

  it('request_id 為空 → error', async () => {
    const { result } = start({ requestId: '' });
    await waitFor(() => expect(result.current.view.kind).toBe('error'));
    expect(fake.apiFetch).not.toHaveBeenCalled();
  });

  it('getAuthorizeAuth 丟錯 → error（目前無法使用）', async () => {
    fake.getAuthorizeAuth.mockImplementation(() => { throw new Error('VITE_API_BASE_URL'); });
    const { result } = start();
    await waitFor(() => expect(result.current.view.kind).toBe('error'));
  });

  it('授權請求已過期或已使用（api 400）→ error', async () => {
    fake.state.restoreOk = true;
    fake.apiFetch.mockImplementation(async (input: string) =>
      String(input).includes('/api/oauth/userinfo') ? json({ email: 'ray@example.com' }) : json({ error: { code: 'DATA_VALIDATION', message: 'x' } }, 400));
    const { result } = start();
    await waitFor(() => expect(result.current.view.kind).toBe('error'));
  });

  it('還原不到登入 → login，登入前不讀授權請求', async () => {
    const { result } = start();
    await waitFor(() => expect(result.current.view.kind).toBe('login'));
    expect(fake.apiFetch).not.toHaveBeenCalled();
  });

  it('還原登入成功 → 直接 confirm（帶 app 名稱、scopes、email）', async () => {
    fake.state.restoreOk = true;
    const { result } = start();
    await waitFor(() => expect(result.current.view.kind).toBe('confirm'));
    expect(result.current.view).toEqual({ kind: 'confirm', request: { appName: 'Tripline', scopes: ['openid', 'profile'] }, email: 'ray@example.com' });
  });

  it.each(['enable', 'disable', 'login'] as const)('reauth=%s → 即使本機有登入也不還原，直接 login', async (reauth) => {
    fake.state.restoreOk = true;
    fake.state.authed = true;
    const { result } = start({ reauth });
    await waitFor(() => expect(result.current.view.kind).toBe('login'));
    expect(fake.restoreSession).not.toHaveBeenCalled();
    expect(fake.apiFetch).not.toHaveBeenCalled();
  });
});

describe('登入', () => {
  it('成功 → 讀授權請求與帳號 → confirm', async () => {
    const { result } = start();
    await waitFor(() => expect(result.current.view.kind).toBe('login'));
    await act(() => result.current.login('ray@example.com', 'pw-pw-pw-pw', false));
    expect(fake.login).toHaveBeenCalledWith('ray@example.com', 'pw-pw-pw-pw');
    expect(result.current.view.kind).toBe('confirm');
    expect(fake.apiFetch).toHaveBeenCalledWith('/api/oauth/authorize/requests/req1');
  });

  it.each([
    ['密碼錯誤', new AuthError('LOGIN_INVALID', 'x', { status: 401 }), '電子郵件或密碼錯誤。', true],
    ['限流帶 Retry-After', new AuthError('LOGIN_RATE_LIMITED', 'x', { status: 429, retryAfter: 120 }), '嘗試次數過多，請 2 分鐘後再試。', false],
    ['限流無 Retry-After', new AuthError('LOGIN_RATE_LIMITED', 'x', { status: 429 }), '嘗試次數過多，請稍後再試。', false],
    ['5xx', new AuthError('SERVER_BOOM', 'x', { status: 500 }), '登入失敗，請稍後再試。', false],
    ['網路', new AuthError('AUTH_NETWORK', 'net'), '登入失敗，請稍後再試。', false],
  ])('登入失敗（%s）→ 留在 login，文案「%s」，credential=%s', async (_n, err, message, credential) => {
    fake.login.mockImplementation(async () => { throw err; });
    const { result } = start();
    await waitFor(() => expect(result.current.view.kind).toBe('login'));
    await act(() => result.current.login('ray@example.com', 'x', false));
    expect(result.current.view).toEqual({ kind: 'login', error: message, credential });
    expect(result.current.busy).toBe(false);
  });

  it('登入後讀授權請求連不上 → error', async () => {
    const { result } = start();
    await waitFor(() => expect(result.current.view.kind).toBe('login'));
    fake.apiFetch.mockImplementation(async () => { throw new TypeError('x'); });
    await act(() => result.current.login('ray@example.com', 'pw', false));
    expect(result.current.view.kind).toBe('error');
  });

  it('一般授權登入後停在 confirm、不自動 approve', async () => {
    const { result } = start();
    await waitFor(() => expect(result.current.view.kind).toBe('login'));
    await act(() => result.current.login('ray@example.com', 'pw', false));
    expect(result.current.view.kind).toBe('confirm');
    expect(count('/approve')).toBe(0);
  });
});

describe('批准', () => {
  const toConfirm = async (opts: { reauth?: ReauthValue | null } = {}) => {
    fake.state.restoreOk = true;
    const hook = start(opts);
    await waitFor(() => expect(hook.result.current.view.kind).toBe('confirm'));
    return hook;
  };

  it('approve → 導向 api 回傳的 redirect_to', async () => {
    const { result } = await toConfirm();
    await act(() => result.current.approve());
    expect(assign).toHaveBeenCalledWith(CB);
    expect(fake.apiFetch).toHaveBeenCalledWith('/api/oauth/authorize/requests/req1/approve', { method: 'POST' });
  });

  it('redirect_to 不安全 → error，不導向', async () => {
    approveRes = () => json({ redirect_to: 'javascript:alert(1)' });
    const { result } = await toConfirm();
    await act(() => result.current.approve());
    expect(result.current.view.kind).toBe('error');
    expect(assign).not.toHaveBeenCalled();
  });

  it('approve 400 → error「請求已過期或已使用」，不導向', async () => {
    approveRes = () => json({ error: { code: 'DATA_VALIDATION', message: 'x' } }, 400);
    const { result } = await toConfirm();
    await act(() => result.current.approve());
    expect(result.current.view).toEqual({ kind: 'error', message: '授權失敗：請求已過期或已使用，請回到 App 重新發起登入。' });
    expect(assign).not.toHaveBeenCalled();
  });

  it('一般 403 PERM_DENIED → 顯示權限說明，不是「請求已過期」', async () => {
    approveRes = () => forbidden('PERM_DENIED');
    const { result } = await toConfirm();
    await act(() => result.current.approve());
    expect(result.current.view).toEqual({ kind: 'error', message: '這個帳號沒有權限完成這次授權，請回 App 換用其他帳號或重新發起登入。' });
    expect(assign).not.toHaveBeenCalled();
  });

  it('一般授權的 403 OAUTH_REAUTH_REQUIRED 不做特殊處理：不登出，是 error', async () => {
    approveRes = () => forbidden('OAUTH_REAUTH_REQUIRED');
    const { result } = await toConfirm();
    await act(() => result.current.approve());
    expect(result.current.view.kind).toBe('error');
    expect(fake.logout).not.toHaveBeenCalled();
  });

  it('連點 approve 只送出一次（ref 防重入）', async () => {
    const { result } = await toConfirm();
    await act(async () => { void result.current.approve(); void result.current.approve(); });
    expect(count('/approve')).toBe(1);
  });

  it('使用其他帳號 → 登出並回 login', async () => {
    const { result } = await toConfirm();
    await act(() => result.current.switchAccount());
    expect(fake.logout).toHaveBeenCalledTimes(1);
    expect(result.current.view.kind).toBe('login');
  });
});

describe('生物辨識意圖（wantBio）', () => {
  it('專門鈕登入（enableBio=true）→ 批准時先 intent 再 approve', async () => {
    const { result } = start();
    await waitFor(() => expect(result.current.view.kind).toBe('login'));
    await act(() => result.current.login('ray@example.com', 'pw', true));
    await act(() => result.current.approve());
    expect(calls().filter((u) => u.endsWith('/intent') || u.endsWith('/approve')).map((u) => u.split('/').pop())).toEqual(['intent', 'approve']);
    expect(assign).toHaveBeenCalledWith(CB);
  });

  it('一般登入（enableBio=false）→ 不呼叫 intent', async () => {
    const { result } = start();
    await waitFor(() => expect(result.current.view.kind).toBe('login'));
    await act(() => result.current.login('ray@example.com', 'pw', false));
    await act(() => result.current.approve());
    expect(count('/intent')).toBe(0);
  });

  it('intent 被拒絕（400）→ 不擋登入，照常導回，沒有錯誤', async () => {
    const base = fake.apiFetch.getMockImplementation()!;
    fake.apiFetch.mockImplementation(async (input: string, init?: RequestInit) =>
      String(input).endsWith('/intent') ? json({ error: { code: 'DATA_VALIDATION', message: 'x' } }, 400) : base(input, init));
    const { result } = start();
    await waitFor(() => expect(result.current.view.kind).toBe('login'));
    await act(() => result.current.login('ray@example.com', 'pw', true));
    await act(() => result.current.approve());
    expect(assign).toHaveBeenCalledWith(CB);
    expect(result.current.view.kind).not.toBe('error');
  });

  it('使用其他帳號後 wantBio 歸零 → 之後的一般登入不送 intent', async () => {
    const { result } = start();
    await waitFor(() => expect(result.current.view.kind).toBe('login'));
    await act(() => result.current.login('ray@example.com', 'pw', true));
    await act(() => result.current.switchAccount());
    await act(() => result.current.login('ray@example.com', 'pw', false));
    await act(() => result.current.approve());
    expect(count('/intent')).toBe(0);
  });
});

describe('重新驗證模式（reauth）', () => {
  it.each(['enable', 'login'] as const)('reauth=%s 登入成功 → 直接 approve 並導向，不停在 confirm', async (reauth) => {
    const { result } = start({ reauth });
    await waitFor(() => expect(result.current.view.kind).toBe('login'));
    await act(() => result.current.login('ray@example.com', 'pw', false));
    expect(assign).toHaveBeenCalledWith(CB);
    expect(calls().filter((u) => u.endsWith('/approve'))).toEqual(['/api/oauth/authorize/requests/req1/approve']);
    expect(result.current.view.kind).toBe('login');
  });

  it('reauth 模式即使 enableBio 也不送 intent', async () => {
    const { result } = start({ reauth: 'enable' });
    await waitFor(() => expect(result.current.view.kind).toBe('login'));
    await act(() => result.current.login('ray@example.com', 'pw', true));
    expect(count('/intent')).toBe(0);
  });

  it('approve 回 OAUTH_REAUTH_REQUIRED → 登出、重顯登入表單；再登入後對同一 request_id 再 approve', async () => {
    let n = 0;
    approveRes = () => (n++ === 0 ? forbidden('OAUTH_REAUTH_REQUIRED') : json({ redirect_to: CB }));
    const { result } = start({ reauth: 'enable' });
    await waitFor(() => expect(result.current.view.kind).toBe('login'));
    await act(() => result.current.login('ray@example.com', 'pw', false));
    expect(fake.logout).toHaveBeenCalledTimes(1);
    expect(result.current.view).toEqual({ kind: 'login', error: '登入已逾時，請重新輸入密碼。' });
    expect(assign).not.toHaveBeenCalled();
    await act(() => result.current.login('ray@example.com', 'pw', false));
    expect(assign).toHaveBeenCalledWith(CB);
    expect(calls().filter((u) => u.endsWith('/approve'))).toEqual(Array(2).fill('/api/oauth/authorize/requests/req1/approve'));
  });

  it('帳號不符：approve 回 200 帶 error callback → 導向該 redirect_to，不顯示錯誤、不重試', async () => {
    const cb = 'https://trip-planner-dby.pages.dev/mobile/oauth/callback?error=reauth_account_mismatch&state=st1';
    approveRes = () => json({ redirect_to: cb });
    const { result } = start({ reauth: 'enable' });
    await waitFor(() => expect(result.current.view.kind).toBe('login'));
    await act(() => result.current.login('ray@example.com', 'pw', false));
    expect(assign).toHaveBeenCalledWith(cb);
    expect(result.current.view.kind).toBe('login');
    expect(count('/approve')).toBe(1);
  });

  it('reauth 模式的一般 403 PERM_DENIED → error 權限說明', async () => {
    approveRes = () => forbidden('PERM_DENIED');
    const { result } = start({ reauth: 'login' });
    await waitFor(() => expect(result.current.view.kind).toBe('login'));
    await act(() => result.current.login('ray@example.com', 'pw', false));
    expect(result.current.view).toEqual({ kind: 'error', message: '這個帳號沒有權限完成這次授權，請回 App 換用其他帳號或重新發起登入。' });
    expect(fake.logout).not.toHaveBeenCalled();
  });
});
