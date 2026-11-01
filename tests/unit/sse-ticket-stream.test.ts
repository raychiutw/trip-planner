/**
 * 即時推送改用一次性 ticket：換票 → 連線 → reconnect 事件／onerror 時重新換票 → 退避與上限。
 * 全部用假的 EventSource 與假的 Api。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openTicketStream, type FakeableEventSource } from '../../src/lib/sse/ticketStream';

class FakeES implements FakeableEventSource {
  static all: FakeES[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  listeners = new Map<string, (ev: { data: string }) => void>();
  constructor(public url: string) { FakeES.all.push(this); }
  addEventListener(type: string, fn: (ev: { data: string }) => void) { this.listeners.set(type, fn); }
  close() { this.closed = true; }
  emit(type: string, data: unknown) { this.listeners.get(type)?.({ data: JSON.stringify(data) }); }
}

type TicketResult = { ok: true; status: 200; data: { ticket: string; expires_in: number } } | { ok: false; status: number; error: unknown };
function makeApi(results: Array<TicketResult | Error>) {
  const post = vi.fn(async () => {
    const r = results.shift() ?? { ok: true, status: 200, data: { ticket: `t${post.mock.calls.length}`, expires_in: 30 } };
    if (r instanceof Error) throw r;
    return r;
  });
  return { post } as unknown as Parameters<typeof openTicketStream>[0]['api'] & { post: typeof post };
}
const ok = (ticket: string): TicketResult => ({ ok: true, status: 200, data: { ticket, expires_in: 30 } });

function setup(over: Partial<Parameters<typeof openTicketStream>[0]> = {}) {
  const api = (over.api ?? makeApi([])) as ReturnType<typeof makeApi>;
  const events = { open: vi.fn(), message: vi.fn(), fatal: vi.fn(), reauth: vi.fn() };
  const refresh = vi.fn(async () => undefined);
  const close = openTicketStream({
    requestId: 77,
    apiBase: 'https://api.test',
    api,
    auth: { refresh },
    createEventSource: (url) => new FakeES(url),
    onOpen: events.open,
    onMessage: events.message,
    onFatal: events.fatal,
    ...over,
  });
  return { api, events, refresh, close };
}
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => { vi.useFakeTimers(); FakeES.all = []; });
afterEach(() => { vi.useRealTimers(); });

describe('openTicketStream', () => {
  it('先 POST sse-ticket 換票，再用 ?ticket= 連 events', async () => {
    const { api } = setup({ api: makeApi([ok('abc 1')]) });
    await flush();
    expect(api.post).toHaveBeenCalledWith('/api/requests/{id}/sse-ticket', { path: { id: '77' }, signal: expect.anything() });
    expect(FakeES.all).toHaveLength(1);
    expect(FakeES.all[0]!.url).toBe('https://api.test/api/requests/77/events?ticket=abc%201');
  });

  it('apiBase 結尾斜線不會變雙斜線', async () => {
    setup({ apiBase: 'https://api.test/', api: makeApi([ok('x')]) });
    await flush();
    expect(FakeES.all[0]!.url).toBe('https://api.test/api/requests/77/events?ticket=x');
  });

  it('訊息與 open 轉給呼叫端', async () => {
    const { events } = setup();
    await flush();
    FakeES.all[0]!.onopen?.();
    FakeES.all[0]!.onmessage?.({ data: '{"status":"open"}' });
    expect(events.open).toHaveBeenCalledTimes(1);
    expect(events.message).toHaveBeenCalledWith({ data: '{"status":"open"}' });
  });

  for (const reason of ['token_expired', 'max_duration']) {
    it(`reconnect(${reason})：關掉舊連線並重新換票再連（不經過退避）`, async () => {
      const { api } = setup({ api: makeApi([ok('t1'), ok('t2')]) });
      await flush();
      const first = FakeES.all[0]!;
      first.onopen?.();
      first.emit('reconnect', { reason });
      expect(first.closed).toBe(true);
      await flush();
      expect(api.post).toHaveBeenCalledTimes(2);
      expect(FakeES.all[1]!.url).toContain('ticket=t2');
    });
  }

  it('reconnect(grant_revoked)：先 refresh() 再換票', async () => {
    const order: string[] = [];
    const api = makeApi([ok('t1'), ok('t2')]);
    api.post.mockImplementation(async () => { order.push('ticket'); return order.length === 1 ? ok('t1') : ok('t2'); });
    const { refresh } = setup({ api, auth: { refresh: async () => { order.push('refresh'); } } });
    await flush();
    FakeES.all[0]!.emit('reconnect', { reason: 'grant_revoked' });
    await flush();
    expect(order).toEqual(['ticket', 'refresh', 'ticket']);
    expect(refresh).not.toHaveBeenCalled(); // 用的是覆寫的那個
    expect(FakeES.all).toHaveLength(2);
  });

  it('reconnect(grant_revoked) 且 refresh 失敗 → 不再連線，回報需要重新登入', async () => {
    const { events } = setup({ auth: { refresh: async () => { throw new Error('AUTH_REQUIRED'); } } });
    await flush();
    FakeES.all[0]!.emit('reconnect', { reason: 'grant_revoked' });
    await flush();
    expect(FakeES.all).toHaveLength(1);
    expect(FakeES.all[0]!.closed).toBe(true);
    expect(events.fatal).toHaveBeenCalledWith('auth_required');
  });

  it('onerror：自己關掉並重新換票（不依賴瀏覽器自動重連），有退避', async () => {
    const { api } = setup({ api: makeApi([ok('t1'), ok('t2')]), backoffBaseMs: 1000 });
    await flush();
    FakeES.all[0]!.onerror?.();
    expect(FakeES.all[0]!.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(999);
    expect(api.post).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2);
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(FakeES.all[1]!.url).toContain('ticket=t2');
  });

  it('連續失敗退避加倍（1s→2s→4s），並有上限', async () => {
    const { api } = setup({ backoffBaseMs: 1000, backoffMaxMs: 3000, maxAttempts: 10 });
    await flush();
    const gaps: number[] = [];
    for (let i = 0; i < 4; i++) {
      FakeES.all[FakeES.all.length - 1]!.onerror?.();
      const before = api.post.mock.calls.length;
      let waited = 0;
      while (api.post.mock.calls.length === before && waited < 10_000) { await vi.advanceTimersByTimeAsync(100); waited += 100; }
      gaps.push(waited);
    }
    expect(gaps).toEqual([1000, 2000, 3000, 3000]);
  });

  it('連續失敗超過上限 → 停止並回報 gave_up，不再換票', async () => {
    const { api, events } = setup({ backoffBaseMs: 10, maxAttempts: 3 });
    await flush();
    for (let i = 0; i < 6; i++) {
      FakeES.all[FakeES.all.length - 1]!.onerror?.();
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(api.post).toHaveBeenCalledTimes(4); // 第一次 + 3 次重試
    expect(events.fatal).toHaveBeenCalledWith('gave_up');
    expect(events.fatal).toHaveBeenCalledTimes(1);
  });

  it('成功開啟連線後重新計算失敗次數', async () => {
    const { api, events } = setup({ backoffBaseMs: 10, maxAttempts: 2 });
    await flush();
    for (let i = 0; i < 5; i++) {
      const es = FakeES.all[FakeES.all.length - 1]!;
      es.onopen?.(); // 每次都有連上
      es.onerror?.();
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(events.fatal).not.toHaveBeenCalled();
    expect(api.post.mock.calls.length).toBe(6);
  });

  it('換票 401（auth client 已 refresh 過仍失敗）→ fatal auth_required，不重試', async () => {
    const { api, events } = setup({ api: makeApi([{ ok: false, status: 401, error: { error: { code: 'AUTH_REQUIRED', message: 'x' } } }]) });
    await flush();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(events.fatal).toHaveBeenCalledWith('auth_required');
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(FakeES.all).toHaveLength(0);
  });

  it('換票丟 AuthError(AUTH_REQUIRED) → fatal auth_required', async () => {
    const e = Object.assign(new Error('需要重新登入'), { code: 'AUTH_REQUIRED' });
    const { events } = setup({ api: makeApi([e]) });
    await flush();
    expect(events.fatal).toHaveBeenCalledWith('auth_required');
  });

  it('換票 404 → fatal ticket_failed（request 不存在，重試沒用）', async () => {
    const { events, api } = setup({ api: makeApi([{ ok: false, status: 404, error: {} }]) });
    await flush();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(events.fatal).toHaveBeenCalledWith('ticket_failed');
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('換票 429／5xx／網路錯誤 → 退避後重試', async () => {
    const { api, events } = setup({
      api: makeApi([{ ok: false, status: 429, error: {} }, { ok: false, status: 503, error: {} }, new TypeError('offline'), ok('good')]),
      backoffBaseMs: 10, maxAttempts: 5,
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(api.post).toHaveBeenCalledTimes(4);
    expect(FakeES.all).toHaveLength(1);
    expect(FakeES.all[0]!.url).toContain('ticket=good');
    expect(events.fatal).not.toHaveBeenCalled();
  });

  it('close()：關閉連線、取消排程中的重連，之後不再換票', async () => {
    const { api, close } = setup({ api: makeApi([ok('t1'), ok('t2')]), backoffBaseMs: 1000 });
    await flush();
    FakeES.all[0]!.onerror?.();
    close();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(FakeES.all[0]!.closed).toBe(true);
  });

  it('close() 發生在換票進行中：換票回來後不建立連線', async () => {
    let release!: (r: TicketResult) => void;
    const api = makeApi([]);
    api.post.mockImplementation(() => new Promise((res) => { release = res as never; }));
    const { close } = setup({ api });
    await flush();
    close();
    release(ok('late'));
    await flush();
    expect(FakeES.all).toHaveLength(0);
  });

  it('已被關閉的舊連線之後才觸發的 onerror 不會多開重連', async () => {
    const { api } = setup({ api: makeApi([ok('t1'), ok('t2'), ok('t3')]), backoffBaseMs: 10 });
    await flush();
    const first = FakeES.all[0]!;
    first.emit('reconnect', { reason: 'max_duration' });
    await flush();
    first.onerror?.(); // 舊連線的遲到事件
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(FakeES.all).toHaveLength(2);
  });
});
