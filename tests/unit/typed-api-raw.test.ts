/**
 * typedApiRaw（#1481）：型別與 typedApi 同一套（契約推導），但傳輸走 apiFetchRaw，
 * 保留「呼叫端自己看狀態碼、非 2xx 不丟例外、沒有重試」的語意；回 `{ ok, status, data | error }`。
 * 另測 `rawBody`：原樣送出字串（不重新序列化），給 ImportTripButton 這類「body 是檔案原文」的呼叫。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { typedApiRaw } from '../../src/lib/api/typed';
import { ApiError } from '../../src/lib/errors';

const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); });

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

describe('typedApiRaw：非 2xx 不丟例外，呼叫端自己看 status', () => {
  it('403 回 { ok:false, status:403, error }，不丟 ApiError', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 'CHANGE_PASSWORD_CURRENT_INVALID', message: 'x' } }, 403));
    const r = await typedApiRaw.post('/api/account/password', { body: { new_password: 'bbbbbbbb' } });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
    expect((r as { error: unknown }).error).toEqual({ error: { code: 'CHANGE_PASSWORD_CURRENT_INVALID', message: 'x' } });
  });

  it('2xx 回 { ok:true, status, data }', async () => {
    fetchMock.mockResolvedValue(json({ authorized: true }));
    const r = await typedApiRaw.get('/api/account/ai-authorization');
    expect(r).toMatchObject({ ok: true, status: 200, data: { authorized: true } });
  });

  it('204 沒有 body：data 是 undefined，不是 JSON 解析錯誤', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const r = await typedApiRaw.post('/api/oauth/logout');
    expect(r).toMatchObject({ ok: true, status: 204, data: undefined });
  });

  it('非 JSON 的錯誤內容（閘道 HTML）原樣放在 error，不丟例外', async () => {
    fetchMock.mockResolvedValue(new Response('<html>bad gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }));
    const r = await typedApiRaw.get('/api/account/ai-authorization');
    expect(r.ok).toBe(false);
    expect(r.status).toBe(502);
  });
});

describe('typedApiRaw：沒有重試（與 apiFetchRaw 一致）', () => {
  it('GET 遇 429 也只打一次，回 ok:false', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 'SYS_RATE_LIMIT' } }, 429, { 'Retry-After': '2' }));
    const r = await typedApiRaw.get('/api/account/ai-authorization');
    expect(r.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('2xx 但 text/html 的邊緣擋頁也不重試、不丟例外', async () => {
    fetchMock.mockResolvedValue(new Response('<html>block</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }));
    await typedApiRaw.get('/api/account/ai-authorization');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('typedApiRaw：傳輸', () => {
  it('路徑去掉 /api 前綴後交給 apiFetchRaw，POST 帶 JSON body 與 Content-Type', async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    await typedApiRaw.post('/api/account/password', { body: { new_password: 'bbbbbbbb' } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/account/password');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(init.body).toBe('{"new_password":"bbbbbbbb"}');
  });

  it('signal 原樣帶到 fetch；網路錯誤轉成 ApiError 往上丟（與 apiFetchRaw 一致）', async () => {
    const ctrl = new AbortController();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await typedApiRaw.get('/api/account/ai-authorization', { signal: ctrl.signal }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(fetchMock.mock.calls[0]![1].signal).toBe(ctrl.signal);
  });
});

describe('rawBody：字串原樣送出', () => {
  it('不重新序列化（保留空白與 key 順序），Content-Type 仍是 application/json', async () => {
    fetchMock.mockResolvedValue(json({ tripId: 't1' }, 201));
    const text = '{ "schemaVersion":1,   "title" : "a" }\n';
    const r = await typedApiRaw.post('/api/trips/import', { rawBody: text });
    expect(r).toMatchObject({ ok: true, status: 201 });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.body).toBe(text);
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });
});

describe('typedApiRaw：帶回應標頭', () => {
  it('result.headers 讀得到 Retry-After', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 'X' } }, 429, { 'Retry-After': '900' }));
    const r = await typedApiRaw.post('/api/oauth/forgot-password', { body: { email: 'a@b.c' } });
    expect(r.headers.get('Retry-After')).toBe('900');
  });
});

describe('typedApiRaw：不看 Content-Type 也解析 JSON（與舊的 res.json() 一致）', () => {
  it('伺服器沒標 JSON 的 Content-Type，內容是 JSON 仍解析成物件', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"expired"}', { status: 400 }));
    const r = await typedApiRaw.post('/api/oauth/verify', { body: { token: 't' } });
    expect(r).toMatchObject({ ok: false, status: 400, error: { error: 'expired' } });
  });

  it('不是 JSON 的內容維持原文字串', async () => {
    fetchMock.mockResolvedValue(new Response('not-json', { status: 500 }));
    const r = await typedApiRaw.post('/api/oauth/verify', { body: { token: 't' } });
    expect(r).toMatchObject({ ok: false, status: 500, error: 'not-json' });
  });
});
