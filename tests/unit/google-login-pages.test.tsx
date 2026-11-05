/**
 * 網頁版 Google 登入改走新 api（flutter#527）：LoginPage 的 Google 按鈕與 /auth/callback 回跳頁。
 * 旗標（VITE_NEW_API_AUTH=1）開：按鈕導向新 api 入口；關：維持舊的同網域連結，完全不碰新路徑。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IDBFactory } from 'fake-indexeddb';
import { createFakeOAuthApi, FAKE_API_BASE } from './__helpers__/fake-oauth-api';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const WEB_ORIGIN = 'https://web.test';
let api: ReturnType<typeof createFakeOAuthApi>;
let idb: IDBFactory;
let assignMock: ReturnType<typeof vi.fn>;
let idbOpenSpy: ReturnType<typeof vi.spyOn>;

async function boot(flag: string | null) {
  idb = new IDBFactory();
  idbOpenSpy = vi.spyOn(idb, 'open');
  api = createFakeOAuthApi();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (new URL(url, WEB_ORIGIN).pathname === '/api/public-config') {
      return new Response(JSON.stringify({ providers: { google: true } }), { status: 200 });
    }
    return api.fetch(input, init);
  }));
  vi.stubGlobal('indexedDB', idb);
  assignMock = vi.fn();
  vi.stubGlobal('location', { origin: WEB_ORIGIN, pathname: '/login', search: '', assign: assignMock });
  if (flag !== null) vi.stubEnv('VITE_NEW_API_AUTH', flag);
  vi.stubEnv('VITE_API_BASE_URL', FAKE_API_BASE);
  vi.resetModules();
  const LoginPage = (await import('../../src/pages/LoginPage')).default;
  const AuthCallbackPage = (await import('../../src/pages/AuthCallbackPage')).default;
  const auth = await import('../../src/lib/auth');
  return { LoginPage, AuthCallbackPage, auth };
}

beforeEach(() => { navigateMock.mockClear(); sessionStorage.clear(); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetModules(); });

describe('LoginPage Google 按鈕', () => {
  it('旗標開：點下去導向新 api 的 Google 入口（redirect_uri 是本站 /auth/callback、帶行程 scope、PKCE、dpop_jkt），並暫存 redirect_after_login', async () => {
    const { LoginPage } = await boot('1');
    render(<MemoryRouter initialEntries={['/login?redirect_after=%2Ftrips%3Fselected%3Dt1']}><LoginPage /></MemoryRouter>);
    const btn = await screen.findByTestId('login-google');
    fireEvent.click(btn);
    await waitFor(() => expect(assignMock).toHaveBeenCalledTimes(1));
    const u = new URL(assignMock.mock.calls[0]![0] as string);
    expect(`${u.origin}${u.pathname}`).toBe(`${FAKE_API_BASE}/api/oauth/login/google`);
    expect(u.searchParams.get('client_id')).toBe('tripline-web');
    expect(u.searchParams.get('redirect_uri')).toBe(`${WEB_ORIGIN}/auth/callback`);
    expect(u.searchParams.get('scope')).toBe('openid profile email trips:read trips:write');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(u.searchParams.get('dpop_jkt')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(u.searchParams.get('state')).toBeTruthy();
  });

  it('旗標開：按鈕不再是指向同網域舊入口的連結', async () => {
    const { LoginPage } = await boot('1');
    render(<MemoryRouter initialEntries={['/login']}><LoginPage /></MemoryRouter>);
    const btn = await screen.findByTestId('login-google');
    expect(btn.getAttribute('href')).toBeNull();
  });

  it('旗標關：維持舊連結（含 redirect_after_login），點擊不導頁、不碰 IndexedDB', async () => {
    const { LoginPage } = await boot(null);
    render(<MemoryRouter initialEntries={['/login?redirect_after=%2Ftrips%3Fselected%3Dt1']}><LoginPage /></MemoryRouter>);
    const btn = await screen.findByTestId('login-google');
    expect(btn.getAttribute('href')).toBe('/api/oauth/login/google?redirect_after_login=%2Ftrips%3Fselected%3Dt1');
    fireEvent.click(btn);
    expect(assignMock).not.toHaveBeenCalled();
    expect(idbOpenSpy).not.toHaveBeenCalled();
  });

  it('旗標明確設為 0 也視為關閉', async () => {
    const { LoginPage } = await boot('0');
    render(<MemoryRouter initialEntries={['/login']}><LoginPage /></MemoryRouter>);
    const btn = await screen.findByTestId('login-google');
    expect(btn.getAttribute('href')).toBe('/api/oauth/login/google');
  });

  it.each([
    ['access_denied', 'Google 登入已取消'],
    ['OAUTH_STATE_MISMATCH', '登入驗證已失效，請重新登入'],
    ['whatever', 'Google 登入失敗，請稍後再試'],
  ])('?google_error=%s 時登入頁顯示訊息', async (code, text) => {
    const { LoginPage } = await boot('1');
    render(<MemoryRouter initialEntries={[`/login?google_error=${code}`]}><LoginPage /></MemoryRouter>);
    expect((await screen.findByRole('alert')).textContent).toContain(text);
  });
});

describe('AuthCallbackPage（/auth/callback）', () => {
  async function startAndGetCallback(opts: { redirectAfterLogin?: string; deny?: boolean } = {}) {
    const ctx = await boot('1');
    const auth = ctx.auth.getNewApiAuth()!;
    const href = await auth.startGoogleLogin({ redirectUri: `${WEB_ORIGIN}/auth/callback`, redirectAfterLogin: opts.redirectAfterLogin });
    const back = api.googleLogin(href, { deny: opts.deny });
    return { ...ctx, back: new URL(back ?? 'https://invalid.test/') };
  }
  const renderCallback = (C: React.ComponentType, search: string) =>
    render(<MemoryRouter initialEntries={[`/auth/callback${search}`]}><C /></MemoryRouter>);

  it('回跳頁恰好一個 h1（DESIGN：每頁一個，可 sr-only），且版面不用 inline style', async () => {
    const { AuthCallbackPage, back } = await startAndGetCallback();
    renderCallback(AuthCallbackPage, back.search);
    const headings = screen.getAllByRole('heading', { level: 1, hidden: true });
    expect(headings).toHaveLength(1);
    expect(headings[0]!.className).toContain('sr-only');
    expect(screen.getByTestId('auth-callback-page').getAttribute('style')).toBeNull();
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
  });

  it('成功：換到 token 後導向 redirect_after_login（replace）', async () => {
    const { AuthCallbackPage, back } = await startAndGetCallback({ redirectAfterLogin: '/trips?selected=t1' });
    renderCallback(AuthCallbackPage, back.search);
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(navigateMock).toHaveBeenCalledWith('/trips?selected=t1', { replace: true });
    expect(api.tokenRequests()).toHaveLength(1);
  });

  it('成功但沒有 redirect_after_login：導向 /trips', async () => {
    const { AuthCallbackPage, back } = await startAndGetCallback();
    renderCallback(AuthCallbackPage, back.search);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/trips', { replace: true }));
  });

  it('暫存的 redirect_after_login 被竄改成站外網址：回跳頁不當開放轉址，改去 /trips', async () => {
    const { AuthCallbackPage, back } = await startAndGetCallback({ redirectAfterLogin: '/trips' });
    const { createIdbAuthStorage } = await import('../../src/lib/auth/storage');
    const store = createIdbAuthStorage({ indexedDB: idb });
    const pending = (await store.takePendingLogin())!;
    await store.savePendingLogin({ ...pending, redirectAfterLogin: '//evil.example.test/x' });
    renderCallback(AuthCallbackPage, back.search);
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(navigateMock).toHaveBeenCalledWith('/trips', { replace: true });
  });

  it('state 不符：不換 token、回登入頁並帶錯誤碼', async () => {
    const { AuthCallbackPage, back } = await startAndGetCallback();
    back.searchParams.set('state', 'forged');
    renderCallback(AuthCallbackPage, back.search);
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(navigateMock).toHaveBeenCalledWith('/login?google_error=OAUTH_STATE_MISMATCH', { replace: true });
    expect(api.tokenRequests()).toHaveLength(0);
  });

  it('使用者在 Google 取消：回登入頁並帶 access_denied', async () => {
    const { AuthCallbackPage, back } = await startAndGetCallback({ deny: true });
    renderCallback(AuthCallbackPage, back.search);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/login?google_error=access_denied', { replace: true }));
  });

  it('旗標關閉時打到這一頁：不嘗試換 token，回登入頁', async () => {
    const { AuthCallbackPage } = await boot(null);
    renderCallback(AuthCallbackPage, '?code=c&state=s');
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/login?google_error=AUTH_DISABLED', { replace: true }));
    expect(api.tokenRequests()).toHaveLength(0);
  });
});
