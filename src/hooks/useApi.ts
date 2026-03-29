/* ===== API Fetch Helpers ===== */

import { reportFetchResult } from './useOnlineStatus';
import { ApiError } from '../lib/errors';
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
  return response.json() as Promise<T>;
}
