/**
 * apiFetch 的 signal 要涵蓋 token 刷新階段（#1688 code-review）：
 * 冷載入最先、最可能卡住的就是 refresh，逾時 signal 必須在那裡也能中斷呼叫端；
 * 但不能取消 refresh 本身（single-flight 與 Web Locks 共用，其他呼叫者還要用）。
 * 真的 createAuthClient + 會卡住的假 token 端點，不 mock apiFetch。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.unmock('../../src/lib/auth');
import { createMemoryAuthStorage } from '../../src/lib/auth/storage';
import { createAuthClient } from '../../src/lib/auth/client';
import { createFakeOAuthApi, FAKE_API_BASE, FAKE_EMAIL, FAKE_PASSWORD } from './__helpers__/fake-oauth-api';

const TIMEOUT_MS = 15_000;

/** 登入後換一個沒有 access token 的新 client（模擬冷載入），其 token 端點會卡住直到 release()。 */
async function coldClientWithHangingTokenEndpoint() {
  const api = createFakeOAuthApi();
  const storage = createMemoryAuthStorage();
  await createAuthClient({ apiBase: FAKE_API_BASE, storage, fetch: api.fetch }).login(FAKE_EMAIL, FAKE_PASSWORD);
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const hangingFetch: typeof fetch = async (input, init) => {
    if (String(input).includes('/api/oauth/token')) await gate;
    return api.fetch(input, init);
  };
  const client = createAuthClient({ apiBase: FAKE_API_BASE, storage, fetch: hangingFetch });
  return { api, client, release };
}

afterEach(() => { vi.useRealTimers(); });

describe('apiFetch 的 signal 涵蓋 refresh 階段', () => {
  it('refresh 卡住時，逾時 signal 讓 apiFetch 在約逾時時間內以 abort 原因 reject', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { client, release } = await coldClientWithHangingTokenEndpoint();
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(new DOMException('timeout', 'TimeoutError')), TIMEOUT_MS);

    let settled: 'pending' | 'rejected' | 'resolved' = 'pending';
    const p = client.apiFetch('/api/me', { signal: ctl.signal });
    const outcome = p.then(() => { settled = 'resolved'; }, (e) => { settled = 'rejected'; return e; });
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1);
    expect(settled).toBe('pending');
    await vi.advanceTimersByTimeAsync(2);
    const err = await outcome;
    expect(settled).toBe('rejected');
    expect((err as DOMException).name).toBe('TimeoutError');
    release();
  });

  it('逾時不取消 refresh：之後 refresh 完成，其他呼叫者照常拿到 token', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { api, client, release } = await coldClientWithHangingTokenEndpoint();
    const ctl = new AbortController();
    const aborted = client.apiFetch('/api/me', { signal: ctl.signal }).catch((e) => e);
    // 另一個沒有 signal 的呼叫者共用同一次 refresh
    const other = client.apiFetch('/api/me');
    await vi.advanceTimersByTimeAsync(10);
    ctl.abort(new DOMException('timeout', 'TimeoutError'));
    expect(((await aborted) as DOMException).name).toBe('TimeoutError');

    release();
    const res = await other;
    expect(res.status).toBe(200);
    expect(api.state.refreshCalls).toBe(1); // 單一 refresh，沒被取消也沒重送
    expect((await client.apiFetch('/api/me')).status).toBe(200);
  });

  it('signal 已經 abort 時不啟動 refresh，直接以原因 reject', async () => {
    const { api, client, release } = await coldClientWithHangingTokenEndpoint();
    const ctl = new AbortController();
    ctl.abort(new DOMException('gone', 'AbortError'));
    await expect(client.apiFetch('/api/me', { signal: ctl.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(api.state.refreshCalls).toBe(0);
    release();
  });
});
