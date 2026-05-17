// @vitest-environment jsdom
/**
 * v2.31.44 hotfix: apiFetch 對 204 No Content 應 return undefined，
 * 不要 call response.json()（SyntaxError）。
 *
 * Bug 取證（v2.31.43 prod QA）：ExplorePage heart toggle off → DELETE
 * /poi-favorites/:id → backend functions/api/poi-favorites/[id].ts:65
 * `return new Response(null, { status: 204 })`。apiFetch line 48 永遠
 * `response.json() as Promise<T>` → empty body json() throws
 * `Failed to execute 'json' on 'Response': Unexpected end of JSON input`。
 *
 * Toast 顯：「取消收藏失敗：Failed to execute 'json' on 'R...」。
 *
 * 影響範圍：所有 apiFetch DELETE callsite（PoiFavoritesPage selection
 * delete / segments dispose / sessions revoke / connected-apps revoke /
 * trip delete / day delete / entries delete）皆 broken。PoiFavoritesPage
 * 因 `.catch(err => ({ ok: false }))` swallow + 「刪除失敗 N 個」toast
 * 隱藏實際成功的刪除，user 沒察覺。
 *
 * Fix：apiFetch.ts line 48 前加 `if (response.status === 204) return
 * undefined as T;`。callers 對 DELETE 通常不用 return value，cast 成 T
 * 不破壞 type signature。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiFetch } from '../../src/lib/apiClient';

describe('v2.31.44 apiFetch 204 No Content', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('204 response 不 call response.json()，return undefined', async () => {
    const jsonSpy = vi.fn().mockRejectedValue(new SyntaxError('Unexpected end of JSON input'));
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 204, statusText: 'No Content' }),
    );
    // Spy on Response.prototype.json — 204 path 不該觸發
    const proto = Response.prototype;
    const realJson = proto.json;
    proto.json = jsonSpy;
    try {
      const result = await apiFetch('/poi-favorites/8001', { method: 'DELETE' });
      expect(result).toBeUndefined();
      expect(jsonSpy).not.toHaveBeenCalled();
    } finally {
      proto.json = realJson;
    }
  });

  it('200 response 仍走 json() path', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const result = await apiFetch<{ ok: boolean }>('/some-endpoint');
    expect(result).toEqual({ ok: true });
  });
});
