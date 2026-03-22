/* ===== Typed API Fetch Helper ===== */

import { reportFetchResult } from './useOnlineStatus';

export async function apiFetch<T>(path: string, opts?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  const headers: Record<string, string> = { ...opts?.headers as Record<string, string> };
  // Only set Content-Type for requests with a body (POST/PUT/PATCH)
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
    // fetch() itself threw — genuine network failure (offline, DNS, etc.)
    reportFetchResult(false);
    throw networkError;
  }

  if (!response.ok) {
    // HTTP error — could be a server issue; don't treat as offline
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }

  // Successful response — signal that we are online
  reportFetchResult(true);
  return response.json() as Promise<T>;
}
