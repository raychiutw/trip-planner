/* ===== API Fetch Helpers ===== */

// v2.33.54 round 10: import from lib/networkBus (was '../hooks/useOnlineStatus'
// — broke lib→hooks reverse import, lib is leaf layer).
import { reportFetchResult } from './networkBus';
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

/**
 * Parse `Retry-After` header to milliseconds. Supports two RFC 7231 forms:
 *   - delta-seconds: 整數秒數
 *   - HTTP-date: e.g. "Wed, 21 Oct 2026 07:28:00 GMT"
 *
 * Cap upper bound at 30s — avoid blocking UI 太久。Backend rate-limit 通常
 * < 5s；超過 30s 表示 server 想拒更久，第一輪 retry 沒意義。
 */
export function parseRetryAfter(header: string | null): number {
  if (!header) return 0;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) {
    const sec = Number(trimmed);
    return Math.min(sec, 30) * 1000;
  }
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - Date.now();
    if (delta <= 0) return 0;
    return Math.min(delta, 30_000);
  }
  return 0;
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
  let retried = false;

  // 內部 helper 跑單次 fetch（不重試）。Network error 直接 throw。
  const doFetch = async (): Promise<Response> => {
    try {
      return await fetch('/api' + path, { ...opts, headers });
    } catch (networkError) {
      reportFetchResult(false);
      throw ApiError.fromNetworkError(networkError);
    }
  };

  response = await doFetch();

  // v2.33.130 G10: 429 → 讀 Retry-After 等候 + 1 次 retry（idempotent methods
  // 才 retry — POST/PATCH/DELETE retry 可能 double-mutate）。第二次仍 429 才
  // throw → user 看 toast，自己決定要不要再試。
  if (response.status === 429 && !retried) {
    const isIdempotent = method === 'GET' || method === 'HEAD';
    if (isIdempotent) {
      const waitMs = parseRetryAfter(response.headers.get('Retry-After')) || 1000;
      await new Promise((r) => setTimeout(r, waitMs));
      // 檢查 signal 是否在 wait 期間被 abort
      if (opts?.signal?.aborted) {
        throw ApiError.fromNetworkError(new DOMException('aborted', 'AbortError'));
      }
      retried = true;
      response = await doFetch();
    }
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
