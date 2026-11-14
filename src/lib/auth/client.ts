/**
 * 新 api 的 auth client（OAuth public client：PKCE + DPoP）。
 *
 * - access token 只放這個 closure 的記憶體；持久儲存（AuthStorage）只收 refresh token 與 DPoP 金鑰。
 * - refresh 是 single-flight：併發呼叫共用同一次請求（refresh 每次輪替，併發送兩次就會觸發 reuse 偵測、撤銷整個 family）。
 *   再加跨分頁的 Web Locks（可用時）：鎖內重新讀 refresh token，避免兩個分頁拿同一顆舊 token 互相踩。
 * - invalid_grant（被重用／撤銷／過期）→ 清除本地並要求重新登入。網路錯誤與 5xx／429 是暫時性的：不清憑證、不登出。
 * - 切換 flag 後沒有新格式的 refresh token＋金鑰，一律視為未登入，不嘗試沿用舊 cookie。
 */
import { exportPublicJwk, generateDpopKeyPair, createDpopProof, jwkThumbprint } from './dpop';
import { createPkcePair } from './pkce';
import type { AuthStorage } from './storage';

export const CLIENT_ID = 'tripline-web';

/**
 * 登入請求要的 scope。login 端點沒帶 scope 時只簽 openid profile email，資源伺服器要 trips:read／trips:write，
 * 少了會讀行程全 403（flutter#517／#521）。需授權伺服器先把行程 scope 登記進 tripline-web 的 allowed_scopes（後端票 #519），否則會被 invalid_scope 拒絕。
 */
export const LOGIN_SCOPE = 'openid profile email trips:read trips:write';

export class AuthError extends Error {
  readonly code: string;
  readonly status?: number;
  /** 429 時 Retry-After 的秒數。 */
  readonly retryAfter?: number;
  constructor(code: string, message: string, extra: { status?: number; retryAfter?: number } = {}) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = extra.status;
    this.retryAfter = extra.retryAfter;
  }
}

const authRequired = (why: string) => new AuthError('AUTH_REQUIRED', `需要重新登入：${why}`);

export interface AuthClientOptions {
  /** 新 api 的網址（VITE_API_BASE_URL）。 */
  apiBase: string;
  storage: AuthStorage;
  fetch?: typeof fetch;
  /** refresh 失敗且憑證已清除、或根本沒有登入時呼叫，讓 UI 導向登入頁。 */
  onReauthRequired?: () => void;
  /** 序列化 refresh 的鎖；預設用 navigator.locks（沒有就不鎖）。 */
  lock?: <T>(fn: () => Promise<T>) => Promise<T>;
}

export interface AuthClient {
  login(email: string, password: string): Promise<void>;
  refresh(): Promise<void>;
  /** 頁面載入時用持久的 refresh token＋金鑰換新 access token；沒有憑證回 false。 */
  restoreSession(): Promise<boolean>;
  logout(): Promise<void>;
  apiFetch(input: string | URL, init?: RequestInit): Promise<Response>;
  isAuthenticated(): boolean;
  /** 最近一次 token 回應的 id_token（只在記憶體；顯示用，見 idToken.ts）。 */
  getIdToken(): string | null;
}

interface TokenResponse { access_token: string; refresh_token: string; token_type: string; id_token?: string }

const defaultLock = <T>(fn: () => Promise<T>): Promise<T> => {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks;
  return locks ? locks.request('tripline-auth-refresh', fn) : fn();
};

async function readErrorCode(res: Response): Promise<{ code: string; message: string }> {
  try {
    const j = await res.json() as { error?: string | { code?: string; message?: string }; error_description?: string };
    if (typeof j.error === 'string') return { code: j.error, message: j.error_description ?? j.error };
    if (j.error && typeof j.error === 'object') return { code: j.error.code ?? 'UNKNOWN', message: j.error.message ?? '' };
  } catch { /* 非 JSON */ }
  return { code: 'UNKNOWN', message: `HTTP ${res.status}` };
}

/** 等 refresh 時對呼叫端的 signal 競速：abort 就以其原因 reject，但不取消 refresh 本身（single-flight 共用）。 */
function refreshOrAbort(refresh: () => Promise<void>, signal?: AbortSignal | null): Promise<void> {
  if (!signal) return refresh();
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    refresh().then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

export function createAuthClient(opts: AuthClientOptions): AuthClient {
  const apiBase = opts.apiBase.replace(/\/+$/, '');
  const { storage } = opts;
  const doFetch: typeof fetch = opts.fetch ?? ((...a) => globalThis.fetch(...a));
  const lock = opts.lock ?? defaultLock;

  // ---- 只存在記憶體的狀態 ----
  let accessToken: string | null = null;
  let idToken: string | null = null;
  let keyPairCache: CryptoKeyPair | null = null;
  let inflightRefresh: Promise<void> | null = null;
  let loggingOut = false;

  const url = (path: string) => new URL(path, apiBase + '/').href;

  async function clearLocal(): Promise<void> {
    accessToken = null;
    idToken = null;
    keyPairCache = null;
    await storage.clear();
  }

  async function failReauth(why: string): Promise<never> {
    await clearLocal();
    if (!loggingOut) opts.onReauthRequired?.();
    throw authRequired(why);
  }

  async function getKeyPair(): Promise<CryptoKeyPair | null> {
    keyPairCache ??= await storage.getKeyPair();
    return keyPairCache;
  }

  async function send(target: string, init: RequestInit, token: string, keyPair: CryptoKeyPair): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `DPoP ${token}`);
    headers.set('DPoP', await createDpopProof({ keyPair, method: init.method ?? 'GET', url: target, accessToken: token }));
    try {
      return await doFetch(target, { ...init, headers });
    } catch (e) {
      throw new AuthError('AUTH_NETWORK', e instanceof Error ? e.message : '網路錯誤');
    }
  }

  /** 打 token endpoint（form，帶 DPoP proof）。回傳解析好的 token，或丟 AuthError（code=OAuth error）。 */
  async function postToken(params: Record<string, string>, keyPair: CryptoKeyPair): Promise<TokenResponse> {
    const target = url('/api/oauth/token');
    let res: Response;
    try {
      res = await doFetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          DPoP: await createDpopProof({ keyPair, method: 'POST', url: target }),
        },
        body: new URLSearchParams(params).toString(),
      });
    } catch (e) {
      throw new AuthError('AUTH_NETWORK', e instanceof Error ? e.message : '網路錯誤');
    }
    if (!res.ok) {
      const { code, message } = await readErrorCode(res);
      if (res.status >= 500 || res.status === 429) {
        throw new AuthError('AUTH_UNAVAILABLE', message, { status: res.status, retryAfter: Number(res.headers.get('Retry-After')) || undefined });
      }
      throw new AuthError(code, message, { status: res.status });
    }
    const t = await res.json() as Partial<TokenResponse>;
    if (!t.access_token || !t.refresh_token || t.token_type !== 'DPoP') {
      throw new AuthError('AUTH_PROTOCOL', 'token 回應格式不符（需要 DPoP 綁定的 token）');
    }
    return t as TokenResponse;
  }

  async function login(email: string, password: string): Promise<void> {
    const keyPair = await generateDpopKeyPair();
    const jkt = await jwkThumbprint(await exportPublicJwk(keyPair));
    const { verifier, challenge } = await createPkcePair();

    let res: Response;
    try {
      res = await doFetch(url('/api/oauth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, password, client_id: CLIENT_ID, code_challenge: challenge, code_challenge_method: 'S256', dpop_jkt: jkt, scope: LOGIN_SCOPE,
        }),
      });
    } catch (e) {
      throw new AuthError('AUTH_NETWORK', e instanceof Error ? e.message : '網路錯誤');
    }
    if (!res.ok) {
      const { code, message } = await readErrorCode(res);
      throw new AuthError(code, message, { status: res.status, retryAfter: Number(res.headers.get('Retry-After')) || undefined });
    }
    const { code } = await res.json() as { code?: string };
    if (!code) throw new AuthError('AUTH_PROTOCOL', 'login 回應缺少 code');

    // 第一方 code 沒有 redirect_uri，兌換時不可帶
    const tokens = await postToken({ grant_type: 'authorization_code', client_id: CLIENT_ID, code, code_verifier: verifier }, keyPair);
    await storage.saveSession({ refreshToken: tokens.refresh_token, keyPair });
    keyPairCache = keyPair;
    accessToken = tokens.access_token;
    idToken = tokens.id_token ?? null;
  }

  async function doRefresh(): Promise<void> {
    // 鎖內才讀：別的分頁剛輪替過的話，這裡讀到的就是新的那顆
    const refreshToken = await storage.getRefreshToken();
    const keyPair = await getKeyPair();
    if (!refreshToken || !keyPair) return failReauth('沒有可用的登入憑證');
    let tokens: TokenResponse;
    try {
      tokens = await postToken({ grant_type: 'refresh_token', client_id: CLIENT_ID, refresh_token: refreshToken }, keyPair);
    } catch (e) {
      // 暫時性失敗（網路、5xx、429）保留憑證；其餘 4xx（invalid_grant 等）= 被重用／撤銷／過期
      if (e instanceof AuthError && e.code !== 'AUTH_NETWORK' && e.code !== 'AUTH_UNAVAILABLE' && e.code !== 'AUTH_PROTOCOL') {
        return failReauth(`refresh 被拒絕（${e.code}）`);
      }
      throw e;
    }
    // 先存下輪替後的新 refresh token，再開放新 access token：舊的已經作廢，掉了就回不去
    await storage.saveRefreshToken(tokens.refresh_token);
    accessToken = tokens.access_token;
    idToken = tokens.id_token ?? null;
  }

  function refresh(): Promise<void> {
    inflightRefresh ??= lock(doRefresh).finally(() => { inflightRefresh = null; });
    return inflightRefresh;
  }

  async function restoreSession(): Promise<boolean> {
    const [refreshToken, keyPair] = await Promise.all([storage.getRefreshToken(), getKeyPair()]);
    if (!refreshToken || !keyPair) {
      if (refreshToken || keyPair) await clearLocal(); // 只剩一半的殘留
      return false;
    }
    try {
      await refresh();
      return true;
    } catch (e) {
      if (e instanceof AuthError && e.code === 'AUTH_REQUIRED') return false;
      throw e;
    }
  }

  async function apiFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
    const target = url(String(input));
    if (!accessToken) {
      if (await storage.getRefreshToken()) await refreshOrAbort(refresh, init.signal);
      else return failReauth('尚未登入');
    }
    const used = accessToken!;
    const keyPair = (await getKeyPair())!;
    const first = await send(target, init, used, keyPair);
    if (first.status !== 401) return first;
    // 別的請求已經 refresh 過就直接重試，不再多輪替一次
    if (accessToken === used) await refreshOrAbort(refresh, init.signal);
    if (!accessToken) return failReauth('refresh 之後仍無 access token');
    return send(target, init, accessToken, (await getKeyPair())!);
  }

  async function logout(): Promise<void> {
    loggingOut = true;
    try {
      // 進行中的 refresh 先等它結束：它已在 api 端輪替，結果要接住才撤銷得到
      await inflightRefresh?.catch(() => undefined);
      if (!accessToken && (await storage.getRefreshToken())) await refresh().catch(() => undefined);
      const keyPair = await getKeyPair();
      if (accessToken && keyPair) {
        await send(url('/api/oauth/logout'), { method: 'POST' }, accessToken, keyPair);
      }
    } catch {
      // 撤銷失敗（網路等）不阻擋本地登出
    } finally {
      await clearLocal();
      loggingOut = false;
    }
  }

  return { login, refresh, restoreSession, logout, apiFetch, isAuthenticated: () => accessToken !== null, getIdToken: () => idToken };
}
