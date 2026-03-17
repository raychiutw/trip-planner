/* ===== Typed API Fetch Helper ===== */

export async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const response = await fetch('/api' + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...opts?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}
