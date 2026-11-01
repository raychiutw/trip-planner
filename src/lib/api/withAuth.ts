import type { AuthClient } from '../auth/client';
import { createApi, type Api } from './client';

/**
 * 接上 T18 的 auth client：每個請求自動帶 `Authorization: DPoP` 與 proof，401 時 refresh 一次再重試。
 * baseUrl 留空：網址由 auth client 的 apiBase 解析。
 */
export function createApiWithAuth(auth: Pick<AuthClient, 'apiFetch'>): Api {
  return createApi({ baseUrl: '', fetch: (input, init) => auth.apiFetch(input, init) });
}
