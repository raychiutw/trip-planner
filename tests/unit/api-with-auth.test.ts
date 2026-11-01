/** createApiWithAuth：實際走 T18 的 auth client（DPoP + 401 refresh 一次）。 */
import { describe, it, expect } from 'vitest';
import { createAuthClient, createMemoryAuthStorage } from '../../src/lib/auth';
import { generateDpopKeyPair } from '../../src/lib/auth/dpop';
import { createApiWithAuth } from '../../src/lib/api/withAuth';

const BASE = 'https://api.test';
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

async function setup(handler: (url: URL, init: RequestInit, n: number) => Response) {
  const storage = createMemoryAuthStorage();
  await storage.saveSession({ refreshToken: 'rt0', keyPair: await generateDpopKeyPair() });
  const seen: { url: string; auth: string | null; dpop: string | null; method: string }[] = [];
  const fetchImpl = (async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const h = new Headers(init.headers);
    seen.push({ url: url.pathname + url.search, auth: h.get('authorization'), dpop: h.get('dpop'), method: init.method ?? 'GET' });
    return handler(url, init, seen.length);
  }) as typeof fetch;
  const auth = createAuthClient({ apiBase: BASE, storage, fetch: fetchImpl, lock: (fn) => fn() });
  return { api: createApiWithAuth(auth), seen, auth };
}

describe('createApiWithAuth', () => {
  it('請求帶 Authorization: DPoP 與 proof，網址由 auth client 的 apiBase 解析', async () => {
    let tokenCalls = 0;
    const { api, seen } = await setup((url) => {
      if (url.pathname === '/api/oauth/token') { tokenCalls++; return json({ access_token: 'at1', refresh_token: 'rt1', token_type: 'DPoP' }); }
      return json({ ticket: 'tk', expires_in: 30 });
    });
    const r = await api.post('/api/requests/{id}/sse-ticket', { path: { id: '12' } });
    expect(r).toEqual({ ok: true, status: 200, data: { ticket: 'tk', expires_in: 30 } });
    const call = seen.find((s) => s.url === '/api/requests/12/sse-ticket')!;
    expect(call.auth).toBe('DPoP at1');
    expect(call.dpop).toBeTruthy();
    expect(call.method).toBe('POST');
    expect(tokenCalls).toBe(1);
  });

  it('401 → refresh 一次後重試成功', async () => {
    let tokenN = 0;
    let apiN = 0;
    const { api, seen } = await setup((url) => {
      if (url.pathname === '/api/oauth/token') { tokenN++; return json({ access_token: `at${tokenN}`, refresh_token: `rt${tokenN}`, token_type: 'DPoP' }); }
      apiN++;
      return apiN === 1 ? json({ error: { code: 'AUTH_REQUIRED', message: 'x' } }, 401) : json([]);
    });
    const r = await api.get('/api/trips');
    expect(r.ok).toBe(true);
    expect(tokenN).toBe(2); // 初次取得 + 401 之後的 refresh
    const apiCalls = seen.filter((s) => s.url === '/api/trips');
    expect(apiCalls.map((c) => c.auth)).toEqual(['DPoP at1', 'DPoP at2']);
  });

  it('refresh 之後仍是 401 → 回 ok:false/401（只重試一次，不無限迴圈）', async () => {
    let tokenN = 0;
    const { api, seen } = await setup((url) => {
      if (url.pathname === '/api/oauth/token') { tokenN++; return json({ access_token: `at${tokenN}`, refresh_token: `rt${tokenN}`, token_type: 'DPoP' }); }
      return json({ error: { code: 'AUTH_REQUIRED', message: 'x' } }, 401);
    });
    const r = await api.get('/api/trips');
    expect(r.ok).toBe(false);
    expect(r.status).toBe(401);
    expect(seen.filter((s) => s.url === '/api/trips')).toHaveLength(2);
    expect(tokenN).toBe(2);
  });
});
