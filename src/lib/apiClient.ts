/* ===== API Fetch Helpers ===== */

import { reportFetchResult } from '../hooks/useOnlineStatus';
import { ApiError } from './errors';
import * as Sentry from '@sentry/react';

/**
 * Trim Sentry breadcrumb payload to avoid PII leak.
 * v2.33.36 security audit round 1: backend `detail` may contain user emails /
 * trip names / partial DB error text; `path` may include `?email=…` query
 * strings. Strip query string and truncate detail to 200 chars before sending.
 */
function scrubForSentry(path: string, detail: string | undefined): { path: string; detail: string | undefined } {
  const cleanPath = path.split('?')[0] ?? path;
  const cleanDetail = typeof detail === 'string'
    ? detail.replace(/[\r\n]+/g, ' ').slice(0, 200)
    : undefined;
  return { path: cleanPath, detail: cleanDetail };
}

/**
 * Detect bodies that already carry their own Content-Type (FormData / Blob /
 * URLSearchParams). Setting `Content-Type: application/json` for these breaks
 * server-side parsing — v2.33.36 code review round 1 finding.
 */
function bodyIsJsonString(body: unknown): boolean {
  return typeof body === 'string';
}

/** Raw fetch that returns the Response — for callers that need status-code inspection. */
export function apiFetchRaw(path: string, opts?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { ...(opts?.headers ?? {}) as Record<string, string> };
  if (opts?.body && bodyIsJsonString(opts.body) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch('/api' + path, { ...opts, headers }).then(
    (r) => { reportFetchResult(true); return r; },
    (e) => { reportFetchResult(false); throw ApiError.fromNetworkError(e); },
  );
}

export async function apiFetch<T>(path: string, opts?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  const headers: Record<string, string> = { ...(opts?.headers ?? {}) as Record<string, string> };
  const method = (opts?.method ?? 'GET').toUpperCase();
  if (
    method !== 'GET' && method !== 'HEAD' && method !== 'DELETE' &&
    opts?.body && bodyIsJsonString(opts.body) && !headers['Content-Type']
  ) {
    headers['Content-Type'] = 'application/json';
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
    // SYS_* 自動上報 Sentry — scrub PII (query string, long detail)
    if (apiError.code.startsWith('SYS_')) {
      const scrubbed = scrubForSentry(path, apiError.detail);
      Sentry.captureException(apiError, {
        tags: { errorCode: apiError.code, category: 'system' },
        extra: { path: scrubbed.path, status: apiError.status, detail: scrubbed.detail },
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
