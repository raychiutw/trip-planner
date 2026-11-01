/**
 * T21：web 的登入與 API 呼叫接到新 api（旗標 VITE_NEW_API_AUTH=1 後面，預設關）。
 * 旗標開啟的情境以 T18 的 fake-oauth-api 做 HTTP 邊界級測試（fetch 是唯一被替換的東西）：
 *   登入（PKCE＋DPoP）→ API 呼叫帶 Authorization＋DPoP → 401→refresh→重試一次 → 登出撤銷並清除。
 * 旗標關閉的行為由既有測試（login-page／api-client／use-current-user／account-page…）守住，這裡只補「關閉時不碰新路徑」。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, renderHook, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IDBFactory } from 'fake-indexeddb';
import { createFakeOAuthApi, FAKE_API_BASE, FAKE_EMAIL, FAKE_PASSWORD } from './__helpers__/fake-oauth-api';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

type Fake = ReturnType<typeof createFakeOAuthApi>;
let api: Fake;
let fetchSpy: ReturnType<typeof vi.fn>;
let lsWrites: string[];
let idb: IDBFactory;

function installBrowserStubs() {
  api = createFakeOAuthApi();
  fetchSpy = vi.fn((input: RequestInfo | URL, init?: RequestInit) => api.fetch(input, init));
  vi.stubGlobal('fetch', fetchSpy);
  vi.stubGlobal('indexedDB', idb);
  lsWrites = [];
  const realSetItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
    lsWrites.push(`${k}=${v}`);
    realSetItem.call(this, k, v);
  });
}

async function boot(flag: string | null = '1') {
  idb = new IDBFactory();
  installBrowserStubs();
  if (flag !== null) vi.stubEnv('VITE_NEW_API_AUTH', flag);
  vi.stubEnv('VITE_API_BASE_URL', FAKE_API_BASE);
  vi.resetModules();
  const auth = await import('../../src/lib/auth');
  const apiClient = await import('../../src/lib/apiClient');
  return { auth, apiClient };
}

beforeEach(() => {
  navigateMock.mockClear();
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

const apiCalls = () => api.requests.filter((r) => !new URL(r.url).pathname.startsWith('/api/oauth/'));

describe('apiClient 走新 api（旗標開）', () => {
  it('登入後 apiFetch 打到 VITE_API_BASE_URL，帶 Authorization: DPoP 與 DPoP proof，且不帶 cookie', async () => {
    const { auth, apiClient } = await boot();
    await auth.getNewApiAuth()!.login(FAKE_EMAIL, FAKE_PASSWORD);
    const me = await apiClient.apiFetch<{ email: string }>('/me');
    expect(me.email).toBe(FAKE_EMAIL);
    const req = apiCalls().at(-1)!;
    expect(req.url).toBe(`${FAKE_API_BASE}/api/me`);
    expect(req.headers['authorization']).toMatch(/^DPoP \S+/);
    expect(req.headers['dpop']).toBeTruthy();
    expect(req.dpopClaims).toMatchObject({ htm: 'GET', htu: `${FAKE_API_BASE}/api/me` });
    // 任何請求都不得打到同源相對路徑（舊 cookie 入口）
    for (const call of fetchSpy.mock.calls) expect(String(call[0])).toMatch(/^https:\/\/api\.test\//);
  });

  it('access token 過期（401）→ single-flight refresh 一次 → 重試一次成功', async () => {
    const { auth, apiClient } = await boot();
    await auth.getNewApiAuth()!.login(FAKE_EMAIL, FAKE_PASSWORD);
    api.expireAccessTokens();
    const results = await Promise.all([apiClient.apiFetch<{ email: string }>('/me'), apiClient.apiFetch<{ email: string }>('/me')]);
    expect(results.map((r) => r.email)).toEqual([FAKE_EMAIL, FAKE_EMAIL]);
    expect(api.state.refreshCalls).toBe(1);
  });

  it('refresh 被拒（invalid_grant）→ 丟 AUTH_REQUIRED(401)、清除本機憑證、導回登入頁（帶 redirect_after）', async () => {
    const assign = vi.fn();
    const { auth, apiClient } = await boot();
    vi.stubGlobal('location', { pathname: '/trips', search: '?selected=x', assign });
    await auth.getNewApiAuth()!.login(FAKE_EMAIL, FAKE_PASSWORD);
    api.expireAccessTokens();
    const storage = auth.createIdbAuthStorage({ indexedDB: idb });
    await storage.saveRefreshToken('garbage'); // api 端視為未知 → invalid_grant
    await expect(apiClient.apiFetch('/me')).rejects.toMatchObject({ code: 'AUTH_REQUIRED', status: 401 });
    expect(api.state.refreshCalls).toBe(1); // 只 refresh 一次
    expect(assign).toHaveBeenCalledWith('/login?redirect_after=' + encodeURIComponent('/trips?selected=x'));
    expect(await storage.getRefreshToken()).toBeNull();
    expect(await storage.getKeyPair()).toBeNull();
    expect(auth.getNewApiAuth()!.isAuthenticated()).toBe(false);
  });

  it('尚未登入：受保護路徑不送出任何請求，回 401；公開路徑（public-config）以匿名請求送到新 api', async () => {
    const { apiClient } = await boot();
    vi.stubGlobal('location', { pathname: '/login', search: '', assign: vi.fn() });
    const res = await apiClient.apiFetchRaw('/my-trips');
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
    const pub = await apiClient.apiFetchRaw('/public-config');
    expect(pub.status).toBe(200);
    const sent = api.requests.at(-1)!;
    expect(sent.url).toBe(`${FAKE_API_BASE}/api/public-config`);
    expect(sent.headers['authorization']).toBeUndefined();
  });

  it('旗標關閉（未設或非 "1"）：apiFetch 仍打同源 /api，不碰新 api 與 IndexedDB', async () => {
    for (const flag of [null, '0', 'true']) {
      const { apiClient } = await boot(flag);
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200, headers: { 'content-type': 'application/json' } }));
      await apiClient.apiFetch('/my-trips');
      expect(fetchSpy.mock.calls[0]![0]).toBe('/api/my-trips');
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });
});

describe('登出（旗標開）', () => {
  it('撤銷 refresh token 家族、清除 IndexedDB 憑證與記憶體 token，之後的受保護請求被擋在本機', async () => {
    const { auth } = await boot();
    const client = auth.getNewApiAuth()!;
    await client.login(FAKE_EMAIL, FAKE_PASSWORD);
    const storage = auth.createIdbAuthStorage({ indexedDB: idb });
    const refreshToken = (await storage.getRefreshToken())!;
    expect(refreshToken).toBeTruthy();
    const { logoutSession } = await import('../../src/lib/logout');
    await logoutSession();
    expect(api.requests.some((r) => r.url === `${FAKE_API_BASE}/api/oauth/logout` && r.headers['dpop'])).toBe(true);
    expect(api.isRefreshRevoked(refreshToken)).toBe(true);
    expect(await storage.getRefreshToken()).toBeNull();
    expect(await storage.getKeyPair()).toBeNull();
    expect(client.isAuthenticated()).toBe(false);
  });

  it('旗標關閉：照舊 POST 同源 /api/oauth/logout（cookie 流程），不碰新 api', async () => {
    await boot(null);
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const { logoutSession } = await import('../../src/lib/logout');
    await logoutSession();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]![0]).toBe('/api/oauth/logout');
    expect((fetchSpy.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });
});

describe('useCurrentUser 走新 api（旗標開）', () => {
  async function probe() {
    const { fetchCurrentUserViaNewApi } = await import('../../src/lib/auth/transport');
    const { getNewApiAuth } = await import('../../src/lib/auth');
    return { fetchCurrentUserViaNewApi, auth: getNewApiAuth()! };
  }

  it('未登入（沒有任何本機憑證）→ 回 401，不送請求、不導頁（行銷頁等公開頁不會被踢）', async () => {
    await boot();
    const assign = vi.fn();
    vi.stubGlobal('location', { pathname: '/', search: '', assign });
    const { fetchCurrentUserViaNewApi, auth } = await probe();
    const res = await fetchCurrentUserViaNewApi(auth);
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it('重新載入頁面：以 IndexedDB 的 refresh token 還原登入後取得 userinfo（帶 DPoP）', async () => {
    const first = await boot();
    await first.auth.getNewApiAuth()!.login(FAKE_EMAIL, FAKE_PASSWORD);
    vi.resetModules(); // 模擬重新載入：記憶體 token 消失，IndexedDB 還在
    const { fetchCurrentUserViaNewApi, auth } = await probe();
    expect(auth.isAuthenticated()).toBe(false);
    const res = await fetchCurrentUserViaNewApi(auth);
    expect(res.status).toBe(200);
    expect((await res.json()).email).toBe(FAKE_EMAIL);
    const req = api.requests.at(-1)!;
    expect(req.url).toBe(`${FAKE_API_BASE}/api/oauth/userinfo`);
    expect(req.headers['authorization']).toMatch(/^DPoP /);
  });

  it('refresh token 被撤銷 → 回 401 且不導頁（探測是靜默的，由 useRequireAuth 決定要不要導）', async () => {
    const first = await boot();
    await first.auth.getNewApiAuth()!.login(FAKE_EMAIL, FAKE_PASSWORD);
    const storage = first.auth.createIdbAuthStorage({ indexedDB: idb });
    vi.resetModules();
    const assign = vi.fn();
    vi.stubGlobal('location', { pathname: '/', search: '', assign });
    await storage.saveRefreshToken('garbage'); // api 端視為未知 → invalid_grant
    const { fetchCurrentUserViaNewApi, auth } = await probe();
    const res = await fetchCurrentUserViaNewApi(auth);
    expect(res.status).toBe(401);
    expect(assign).not.toHaveBeenCalled();
  });
});

describe('useCurrentUser hook（旗標開）', () => {
  it('登入後 hook 取得 user（走新 api 的 userinfo，帶 DPoP，不打同源 cookie 端點）', async () => {
    const { auth } = await boot();
    await auth.getNewApiAuth()!.login(FAKE_EMAIL, FAKE_PASSWORD);
    const { useCurrentUser } = await import('../../src/hooks/useCurrentUser');
    const { result } = renderHook(() => useCurrentUser());
    await waitFor(() => expect(result.current.user).toMatchObject({ email: FAKE_EMAIL }));
    for (const call of fetchSpy.mock.calls) expect(String(call[0])).toMatch(/^https:\/\/api\.test\//);
    expect(api.requests.at(-1)!.url).toBe(`${FAKE_API_BASE}/api/oauth/userinfo`);
  });

  it('未登入 → user 為 null，不送任何請求', async () => {
    await boot();
    const { useCurrentUser } = await import('../../src/hooks/useCurrentUser');
    const { result } = renderHook(() => useCurrentUser());
    await waitFor(() => expect(result.current.user).toBeNull());
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('LoginPage 走新 api 第一方登入（旗標開）', () => {
  async function renderLogin(query = '') {
    const { default: LoginPage } = await import('../../src/pages/LoginPage');
    return render(
      <MemoryRouter initialEntries={[`/login${query ? `?${query}` : ''}`]}>
        <LoginPage />
      </MemoryRouter>,
    );
  }
  const submit = (email: string, password: string) => {
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: email } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: password } });
    fireEvent.click(screen.getByTestId('login-submit'));
  };

  it('成功：PKCE＋DPoP 登入並兌換 token，導向 /trips；token 不進 localStorage／sessionStorage', async () => {
    const { auth } = await boot();
    await renderLogin();
    submit(FAKE_EMAIL, FAKE_PASSWORD);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/trips'));
    const login = api.requests.find((r) => r.url === `${FAKE_API_BASE}/api/oauth/login`)!;
    const body = JSON.parse(login.body);
    expect(body).toMatchObject({ client_id: 'tripline-web', code_challenge_method: 'S256' });
    expect(body.dpop_jkt).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(api.tokenRequests().at(-1)!.headers['dpop']).toBeTruthy();
    expect(auth.getNewApiAuth()!.isAuthenticated()).toBe(true);
    const dump = JSON.stringify([lsWrites, { ...sessionStorage }, { ...localStorage }]);
    const storage = auth.createIdbAuthStorage({ indexedDB: idb });
    const rt = (await storage.getRefreshToken())!;
    expect(rt).toBeTruthy();
    expect(dump).not.toContain(rt);
  });

  it('成功且帶 redirect_after → 導向該路徑（與現行一致）', async () => {
    await boot();
    await renderLogin('redirect_after=%2Fexplore');
    submit(FAKE_EMAIL, FAKE_PASSWORD);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/explore'));
  });

  it('密碼錯誤 → 沿用現有文案「電子郵件或密碼錯誤」、不導頁', async () => {
    await boot();
    await renderLogin();
    submit(FAKE_EMAIL, 'wrong-password');
    await waitFor(() => expect(screen.getByTestId('login-banner-error').textContent).toContain('電子郵件或密碼錯誤'));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('被限流（429＋Retry-After）→ 顯示鎖定倒數（沿用現有元件）', async () => {
    await boot();
    await renderLogin();
    submit('locked@example.test', 'whatever');
    await waitFor(() => expect(screen.queryByTestId('login-page-locked')).toBeTruthy());
    expect(screen.getByTestId('login-locked-countdown').textContent).toBe('10:00'); // Retry-After: 600
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('網路失敗 → 沿用「網路連線失敗」文案', async () => {
    await boot();
    fetchSpy.mockRejectedValue(new TypeError('offline'));
    await renderLogin();
    submit(FAKE_EMAIL, FAKE_PASSWORD);
    await waitFor(() => expect(screen.getByTestId('login-banner-error').textContent).toContain('網路連線失敗'));
  });

  it('旗標關閉：送出仍是同源 POST /api/oauth/login（email＋password，無 PKCE），不碰新 api', async () => {
    await boot(null);
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await renderLogin();
    submit('u@x.com', 'pass1234');
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/trips'));
    const loginCall = fetchSpy.mock.calls.find((c) => c[0] === '/api/oauth/login')!;
    expect(JSON.parse((loginCall[1] as RequestInit).body as string)).toEqual({ email: 'u@x.com', password: 'pass1234' });
    expect(api.requests).toHaveLength(0);
  });
});
