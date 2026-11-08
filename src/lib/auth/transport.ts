/**
 * apiClient／useCurrentUser 的傳輸層：請求送新 api。
 *
 * - 受保護路徑：交給 auth client 的 `apiFetch`（帶 `Authorization: DPoP` 與 proof；401 時 single-flight refresh 並重試一次）。
 *   auth client 判定需重新登入時（`AuthError: AUTH_REQUIRED`）轉成合成的 401 Response，呼叫端沿用既有的 401 處理。
 * - 公開路徑（`contracts/openapi.json` 裡沒有 security 的端點：登入、註冊、忘記密碼、public-config…）：
 *   未登入也要能打，所以以匿名請求（不帶 cookie、不帶 token）直送新 api；已登入則仍帶 token（optional-auth 端點要認得人）。
 * - 網路錯誤、5xx／429 的暫時性 refresh 失敗（`AUTH_NETWORK`／`AUTH_UNAVAILABLE`）原樣往上丟，不當成登出。
 */
import { writeAuthHint } from '../authHint';
import { AuthError, type AuthClient } from './client';

/** `/api` 之後的路徑前綴；來源：contracts/openapi.json 中沒有 `security` 的 operation。 */
const PUBLIC_PREFIXES = [
  '/oauth/login', '/oauth/signup', '/oauth/verify', '/oauth/send-verification',
  '/oauth/forgot-password', '/oauth/reset-password', '/oauth/client-info',
  '/public-config', '/poi-search', '/route', '/reports', '/share/',
];

export function isPublicApiPath(path: string): boolean {
  const p = path.split('?')[0] ?? path;
  return PUBLIC_PREFIXES.some((prefix) => (prefix.endsWith('/') ? p.startsWith(prefix) : p === prefix));
}

function unauthorized(message: string): Response {
  return new Response(JSON.stringify({ error: { code: 'AUTH_REQUIRED', message } }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---- 靜默探測：useCurrentUser 在公開頁（行銷頁、登入頁）也會探測登入狀態，失敗不該把人踢走 ----
let quietDepth = 0;

/** 預設的「需要重新登入」處理：清掉「已登入」提示、導回登入頁並保留原頁面（靜默探測期間、已在登入頁時不動作）。 */
export function defaultReauthHandler(): void {
  if (quietDepth > 0) return;
  writeAuthHint(false);
  const { pathname, search } = globalThis.location;
  if (pathname.startsWith('/login')) return;
  globalThis.location.assign(`/login?redirect_after=${encodeURIComponent(`${pathname}${search}`)}`);
}

async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  quietDepth++;
  try { return await fn(); } finally { quietDepth--; }
}

/** `path` 含 `/api` 前綴（例如 `/api/my-trips`）。 */
export async function sendViaNewApi(auth: AuthClient, apiBase: string, path: string, init: RequestInit = {}): Promise<Response> {
  const bareApiPath = path.replace(/^\/api/, '');
  if (isPublicApiPath(bareApiPath) && !auth.isAuthenticated()) {
    return fetch(new URL(path, apiBase.replace(/\/+$/, '') + '/').href, { ...init, credentials: 'omit' });
  }
  try {
    return await auth.apiFetch(path, init);
  } catch (e) {
    if (e instanceof AuthError && e.code === 'AUTH_REQUIRED') return unauthorized(e.message);
    throw e;
  }
}

/** useCurrentUser 的新 api 版：沒有任何本機憑證回 401（不送請求）；有就還原登入後取 userinfo。 */
export async function fetchCurrentUserViaNewApi(auth: AuthClient): Promise<Response> {
  return quiet(async () => {
    try {
      if (!auth.isAuthenticated() && !(await auth.restoreSession())) return unauthorized('尚未登入');
      return await auth.apiFetch('/api/oauth/userinfo');
    } catch (e) {
      if (e instanceof AuthError && e.code === 'AUTH_REQUIRED') return unauthorized(e.message);
      throw e;
    }
  });
}
