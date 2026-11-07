/**
 * #1437：PWA 的 api-cache 會存登入後的行程／筆記回應（SW 讀不到 Cookie，cacheWillUpdate 的判斷不成立），
 * 登出必須清掉，否則共用裝置的下一個人可從快取讀到。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/auth', () => ({ getNewApiAuth: () => null }));
vi.mock('../../src/lib/apiClient', () => ({
  apiFetchRaw: vi.fn(async () => new Response(null, { status: 204 })),
}));

afterEach(() => vi.unstubAllGlobals());

describe('logoutSession 清 PWA api-cache', () => {
  it('登出後 caches.delete 被呼叫於 api-cache 與 api-cache-dev', async () => {
    const del = vi.fn(async () => true);
    vi.stubGlobal('caches', { delete: del });
    const { logoutSession } = await import('../../src/lib/logout');
    await logoutSession();
    expect(del).toHaveBeenCalledWith('api-cache');
    expect(del).toHaveBeenCalledWith('api-cache-dev');
  });

  it('沒有 Cache API（舊環境／測試）時登出不丟錯', async () => {
    vi.stubGlobal('caches', undefined);
    const { logoutSession } = await import('../../src/lib/logout');
    await expect(logoutSession()).resolves.toBeUndefined();
  });

  it('caches.delete 失敗不阻擋登出', async () => {
    vi.stubGlobal('caches', { delete: vi.fn(async () => { throw new Error('boom'); }) });
    const { logoutSession } = await import('../../src/lib/logout');
    await expect(logoutSession()).resolves.toBeUndefined();
  });
});
