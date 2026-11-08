/**
 * useRequestSSE — robust polling tests
 *
 * Background: chat SSE 端點 server 上限 30 min；client 之前只在 SSE error
 * 才 fallback polling。Server clean-close 觸發 EventSource auto-reconnect 但
 * 不一定觸 onerror → polling 永遠不啟動 → request 完成後 user 看不到 reply。
 *
 * v2.31.6 改成：polling 永遠跑（safety-net 30s interval），SSE 只是 latency
 * optimization。第一個看到 terminal 的 source 贏。401 → errorReason='auth_expired'。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRequestSSE } from '../../src/hooks/useRequestSSE';

class MockEventSource {
  url: string;
  withCredentials: boolean;
  onopen: ((this: EventSource) => unknown) | null = null;
  onmessage: ((this: EventSource, ev: MessageEvent) => unknown) | null = null;
  onerror: ((this: EventSource) => unknown) | null = null;
  readyState: number = 0;
  static instances: MockEventSource[] = [];
  constructor(url: string, init?: EventSourceInit) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }
  close() { this.readyState = 2; }
  addEventListener() { /* ticket 連線註冊 reconnect 事件；這裡不模擬 */ }
  static reset() { MockEventSource.instances = []; }
}

const originalEventSource = globalThis.EventSource;

/** 輪詢請求回 `poll`；換 SSE ticket 的請求（POST …/sse-ticket）回一張假 ticket。 */
function mockFetch(poll: Response) {
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) =>
    String(url).endsWith('/sse-ticket')
      ? new Response(JSON.stringify({ ticket: 'tk', expires_in: 30 }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response(await poll.clone().text(), { status: poll.status, headers: { 'Content-Type': 'application/json' } }));
}
/** ticket 連線模組是動態載入、換票是非同步：等它們落定，EventSource 才會建立。 */
const settle = () => act(async () => { await vi.dynamicImportSettled(); await vi.advanceTimersByTimeAsync(0); });

describe('useRequestSSE — safety-net polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.reset();
    (globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource = MockEventSource;
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as unknown as { EventSource: typeof EventSource }).EventSource = originalEventSource;
    vi.restoreAllMocks();
  });

  it('polling runs as safety-net even when SSE connects ok', async () => {
    mockFetch(
      new Response(JSON.stringify({ status: 'processing', processedBy: null }), { status: 200 }),
    );

    renderHook(() => useRequestSSE(42));
    await settle();

    expect(MockEventSource.instances.length).toBe(1);

    // SSE connects but never sends — wait 30s, polling should fire
    await act(async () => { await vi.advanceTimersByTimeAsync(30_001); });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/requests/42', expect.anything());
  });

  it('polling sees completed', async () => {
    mockFetch(
      new Response(JSON.stringify({ status: 'completed', processedBy: 'api' }), { status: 200 }),
    );

    const { result } = renderHook(() => useRequestSSE(42));
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_001); });
    expect(result.current.status).toBe('completed');
  });

  it('401 from polling sets errorReason=auth_expired', async () => {
    mockFetch(
      new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }),
    );

    const { result } = renderHook(() => useRequestSSE(99));
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_001); });
    expect(result.current.errorReason).toBe('auth_expired');
  });

  it('elapsedMs ticks up at minute boundaries while in flight', async () => {
    // v2.33.31 (simplify PR-4): tick changed from 1s to 60s — UI consumers
    // only read minute buckets so per-second updates wasted React renders.
    mockFetch(
      new Response(JSON.stringify({ status: 'processing', processedBy: null }), { status: 200 }),
    );

    const { result } = renderHook(() => useRequestSSE(77));
    // 5 s 後 still 0（ tick 是 60 s interval）
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(result.current.elapsedMs).toBe(0);
    // 60 s 後第一次 tick
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(60_000);
    // 65 s 累計 + 60 s = 125 s 後第二次 tick
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(120_000);
  });

  it('SSE onmessage completed terminates polling', async () => {
    mockFetch(
      new Response(JSON.stringify({ status: 'processing', processedBy: null }), { status: 200 }),
    );

    const { result } = renderHook(() => useRequestSSE(55));
    await settle();
    const es = MockEventSource.instances[0]!;
    await act(async () => {
      es.onmessage?.call(es as unknown as EventSource, new MessageEvent('message', {
        data: JSON.stringify({ status: 'completed', processedBy: 'api' }),
      }));
    });
    expect(result.current.status).toBe('completed');
    expect(es.readyState).toBe(2);
  });

  it('null requestId → no SSE, no polling', () => {
    renderHook(() => useRequestSSE(null));
    expect(MockEventSource.instances.length).toBe(0);
  });
});
