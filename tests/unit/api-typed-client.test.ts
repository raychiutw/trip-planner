/**
 * T19 typed client 的執行期行為：path／query／body 組裝、狀態碼判別、非 JSON 回應、錯誤原樣保留。
 * 假 server = fetch stub。
 */
import { describe, it, expect, vi } from 'vitest';
import { createApi } from '../../src/lib/api/client';

type Call = { url: string; init: RequestInit };
function stub(res: () => Response) {
  const calls: Call[] = [];
  const fetchStub = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return res();
  });
  return { calls, fetchStub: fetchStub as unknown as typeof fetch };
}
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

describe('createApi — 請求組裝', () => {
  it('path 參數代入樣板、並 encodeURIComponent', async () => {
    const { calls, fetchStub } = stub(() => json({ id: 1 }));
    const api = createApi({ baseUrl: 'https://api.test', fetch: fetchStub });
    await api.get('/api/requests/{id}', { path: { id: 'a/b c?d#e' } });
    expect(calls[0]!.url).toBe('https://api.test/api/requests/a%2Fb%20c%3Fd%23e');
    expect(calls[0]!.init.method).toBe('GET');
  });

  it('多個 path 參數各自代入', async () => {
    const { calls, fetchStub } = stub(() => json({}));
    const api = createApi({ baseUrl: '', fetch: fetchStub });
    await api.patch('/api/trips/{id}/entries/{eid}', { path: { id: 't 1', eid: 7 as unknown as string }, body: {} });
    expect(calls[0]!.url).toBe('/api/trips/t%201/entries/7');
  });

  it('baseUrl 結尾斜線不會變成雙斜線', async () => {
    const { calls, fetchStub } = stub(() => json({}));
    const api = createApi({ baseUrl: 'https://api.test/', fetch: fetchStub });
    await api.get('/api/trips');
    expect(calls[0]!.url).toBe('https://api.test/api/trips');
  });

  it('query：編碼、略過 undefined、保留 0 與 false', async () => {
    const { calls, fetchStub } = stub(() => json({}));
    const api = createApi({ baseUrl: '', fetch: fetchStub });
    await api.get('/api/poi-search', { query: { q: '東京 塔&', region: undefined, limit: 0 } });
    expect(calls[0]!.url).toBe('/api/poi-search?q=%E6%9D%B1%E4%BA%AC+%E5%A1%94%26&limit=0');
  });

  it('沒有 query 時網址不帶問號', async () => {
    const { calls, fetchStub } = stub(() => json({}));
    await createApi({ baseUrl: '', fetch: fetchStub }).get('/api/trips');
    expect(calls[0]!.url).toBe('/api/trips');
  });

  it('JSON body：序列化、帶 Content-Type；原樣送 snake_case 不轉換', async () => {
    const { calls, fetchStub } = stub(() => json({ ok: 1 }));
    const api = createApi({ baseUrl: '', fetch: fetchStub });
    await api.patch('/api/permissions/{id}', { path: { id: '5' }, body: { role: 'admin' } });
    const init = calls[0]!.init;
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe('{"role":"admin"}');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
  });

  it('沒有 body 的請求不帶 body 與 Content-Type', async () => {
    const { calls, fetchStub } = stub(() => json({ ticket: 't', expires_in: 30 }));
    await createApi({ baseUrl: '', fetch: fetchStub }).post('/api/requests/{id}/sse-ticket', { path: { id: '9' } });
    expect(calls[0]!.init.body).toBeUndefined();
    expect(new Headers(calls[0]!.init.headers).has('content-type')).toBe(false);
    expect(calls[0]!.init.method).toBe('POST');
  });

  it('signal 與額外 headers 會傳給 fetch', async () => {
    const { calls, fetchStub } = stub(() => json({}));
    const ac = new AbortController();
    await createApi({ baseUrl: '', fetch: fetchStub }).get('/api/trips', { signal: ac.signal, headers: { 'X-Test': '1' } });
    expect(calls[0]!.init.signal).toBe(ac.signal);
    expect(new Headers(calls[0]!.init.headers).get('x-test')).toBe('1');
  });

  it('缺少 path 參數在執行期也丟錯（不會送出含 {id} 的網址）', async () => {
    const { calls, fetchStub } = stub(() => json({}));
    const api = createApi({ baseUrl: '', fetch: fetchStub });
    await expect(api.get('/api/requests/{id}', { path: {} as never })).rejects.toThrow(/id/);
    expect(calls).toHaveLength(0);
  });
});

describe('createApi — 回應判別', () => {
  it('2xx → ok:true 與 data', async () => {
    const { fetchStub } = stub(() => json({ ticket: 'abc', expires_in: 30 }));
    const r = await createApi({ baseUrl: '', fetch: fetchStub }).post('/api/requests/{id}/sse-ticket', { path: { id: '1' } });
    expect(r).toEqual({ ok: true, status: 200, data: { ticket: 'abc', expires_in: 30 } });
  });

  it('4xx → ok:false 與 error，error 原樣保留（ApiError 巢狀）', async () => {
    const body = { error: { code: 'DATA_NOT_FOUND', message: '找不到', detail: 'x' } };
    const { fetchStub } = stub(() => json(body, 404));
    const r = await createApi({ baseUrl: '', fetch: fetchStub }).get('/api/requests/{id}', { path: { id: '1' } });
    expect(r).toEqual({ ok: false, status: 404, error: body });
  });

  it('OAuth 扁平錯誤也原樣保留，不轉成 ApiError', async () => {
    const body = { error: 'invalid_grant', error_description: '過期' };
    const { fetchStub } = stub(() => json(body, 400));
    const r = await createApi({ baseUrl: '', fetch: fetchStub }).post('/api/oauth/token', { body: { grant_type: 'refresh_token' } as never });
    expect(r.ok).toBe(false);
    expect((r as { error: unknown }).error).toEqual(body);
  });

  it('5xx 也是 ok:false，status 保留', async () => {
    const { fetchStub } = stub(() => json({ error: { code: 'SYS_INTERNAL', message: 'x' } }, 503));
    const r = await createApi({ baseUrl: '', fetch: fetchStub }).get('/api/trips');
    expect(r.ok).toBe(false);
    expect(r.status).toBe(503);
  });

  it('204 → ok:true、data 為 undefined', async () => {
    const { fetchStub } = stub(() => new Response(null, { status: 204 }));
    const r = await createApi({ baseUrl: '', fetch: fetchStub }).post('/api/oauth/logout');
    expect(r).toEqual({ ok: true, status: 204, data: undefined });
  });

  it('302 → 視為成功（ok:true）、data 為 undefined，不跟隨也不解析 body', async () => {
    const { fetchStub, calls } = stub(() => new Response(null, { status: 302, headers: { Location: 'https://x.test/cb' } }));
    const r = await createApi({ baseUrl: '', fetch: fetchStub }).get('/api/oauth/verify', { query: { token: 't' } });
    expect(r).toEqual({ ok: true, status: 302, data: undefined });
    expect(calls[0]!.init.redirect).toBe('manual');
  });

  it('非 JSON 回應（text/event-stream、純文字）→ data 為字串', async () => {
    const { fetchStub } = stub(() => new Response('hello', { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));
    const r = await createApi({ baseUrl: '', fetch: fetchStub }).get('/api/requests/{id}/events', { path: { id: '1' } });
    expect(r).toEqual({ ok: true, status: 200, data: 'hello' });
  });

  it('錯誤回應不是 JSON 時 error 為原始文字', async () => {
    const { fetchStub } = stub(() => new Response('<html>bad gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }));
    const r = await createApi({ baseUrl: '', fetch: fetchStub }).get('/api/trips');
    expect(r).toEqual({ ok: false, status: 502, error: '<html>bad gateway</html>' });
  });

  it('JSON content-type 但 body 為空 → undefined', async () => {
    const { fetchStub } = stub(() => new Response('', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const r = await createApi({ baseUrl: '', fetch: fetchStub }).get('/api/trips');
    expect(r).toEqual({ ok: true, status: 200, data: undefined });
  });

  it('fetch 本身失敗（網路）→ 原樣 reject，不吞掉', async () => {
    const fetchStub = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    await expect(createApi({ baseUrl: '', fetch: fetchStub }).get('/api/trips')).rejects.toThrow('Failed to fetch');
  });
});
