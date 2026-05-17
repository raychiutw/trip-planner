/* ===== API Fetch Helpers ===== */

import { reportFetchResult } from '../hooks/useOnlineStatus';
import { ApiError } from './errors';
import * as Sentry from '@sentry/react';

/** Raw fetch that returns the Response — for callers that need status-code inspection. */
export function apiFetchRaw(path: string, opts?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { ...(opts?.headers ?? {}) as Record<string, string> };
  if (opts?.body) headers['Content-Type'] = 'application/json';
  return fetch('/api' + path, { ...opts, headers }).then(
    (r) => { reportFetchResult(true); return r; },
    (e) => { reportFetchResult(false); throw ApiError.fromNetworkError(e); },
  );
}

export async function apiFetch<T>(path: string, opts?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  const headers: Record<string, string> = { ...(opts?.headers ?? {}) as Record<string, string> };
  const method = (opts?.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'DELETE') {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  let response: Response;
  try {
    response = await fetch('/api' + path, {
      ...opts,
      headers,
    });
  } catch (networkError) {
    reportFetchResult(false);
    throw ApiError.fromNetworkError(networkError);
  }

  if (!response.ok) {
    const apiError = await ApiError.fromResponse(response);
    // SYS_* 自動上報 Sentry
    if (apiError.code.startsWith('SYS_')) {
      Sentry.captureException(apiError, {
        tags: { errorCode: apiError.code, category: 'system' },
        extra: { path, status: apiError.status, detail: apiError.detail },
      });
    }
    throw apiError;
  }

  reportFetchResult(true);
  // 204 No Content：empty body，`response.json()` 會 throw SyntaxError
  // ("Unexpected end of JSON input")。backend DELETE handlers 普遍返 204
  // （poi-favorites / sessions / connected-apps / trip / day / entries…），
  // 之前 callers 大多 `.catch(...)` swallow 後當失敗顯 toast，user 重整看到
  // 資料消失才知道實際成功 — UX 一直壞，v2.31.43 ExplorePage 直接 surface
  // 才被抓到。
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
