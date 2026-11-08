/**
 * typedApi：契約型別的 typed client，但**傳輸與錯誤語意與 apiFetch 完全一致**（#1481）。
 * 重點不是 typed client 本身（tests/unit/api-client*.test.ts 已測），而是「接在 apiFetch 上」這件事：
 * 旗標關閉走同源 cookie、旗標開啟走新 api；非 2xx 丟 ApiError（含 429 的 Retry-After）；204 回 undefined。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { typedApi, unwrap } from '../../src/lib/api/typed';
import { ApiError } from '../../src/lib/errors';

const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); });

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

describe('typedApi（旗標關閉：同源 /api）', () => {
  it('POST 帶 JSON body 與 Content-Type，路徑不重複 /api 前綴', async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    const r = await typedApi.post('/api/account/password', { body: { current_password: 'a', new_password: 'bbbbbbbb' } });
    expect(unwrap(r)).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/account/password');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ current_password: 'a', new_password: 'bbbbbbbb' }));
  });

  it('帶 body 的 DELETE 也帶 Content-Type（apiFetch 對 DELETE 不會自己補）', async () => {
    fetchMock.mockResolvedValue(json({ ok: true, tripsDeleted: 0, auditRowsAnonymized: 0, tablesCleared: {} }));
    await typedApi.delete('/api/account', { body: { password: 'pw' } });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe('DELETE');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(init.body).toBe('{"password":"pw"}');
  });

  it('非 2xx 丟 ApiError（code、status 與 apiFetch 一致）', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 'CHANGE_PASSWORD_CURRENT_INVALID', message: 'x' } }, 403));
    const err = await typedApi.post('/api/account/password', { body: { new_password: 'bbbbbbbb' } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('CHANGE_PASSWORD_CURRENT_INVALID');
    expect((err as ApiError).status).toBe(403);
  });

  it('429 的 Retry-After 保留在 ApiError.retryAfter（變更密碼頁靠它顯示等待時間）', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 'CHANGE_PASSWORD_RATE_LIMITED' } }, 429, { 'Retry-After': '900' }));
    const err = await typedApi.post('/api/account/password', { body: { new_password: 'bbbbbbbb' } }).catch((e: unknown) => e);
    expect((err as ApiError).retryAfter).toBe(900);
  });

  it('204 沒有 body：data 是 undefined，不是 JSON 解析錯誤', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const r = await typedApi.post('/api/oauth/logout');
    expect(unwrap(r)).toBeUndefined();
  });
});
