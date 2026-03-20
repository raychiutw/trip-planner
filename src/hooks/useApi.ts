/* ===== Typed API Fetch Helper ===== */

export async function apiFetch<T>(path: string, opts?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  const headers: Record<string, string> = { ...opts?.headers as Record<string, string> };
  // Only set Content-Type for requests with a body (POST/PUT/PATCH)
  const method = (opts?.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'DELETE') {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }
  const response = await fetch('/api' + path, {
    ...opts,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}
