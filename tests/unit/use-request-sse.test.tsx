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
  static reset() { MockEventSource.instances = []; }
}

const originalEventSource = globalThis.EventSource;

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
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ status: 'processing', processedBy: null }), { status: 200 }),
    );

    renderHook(() => useRequestSSE(42));

    expect(MockEventSource.instances.length).toBe(1);

    // SSE connects but never sends — wait 30s, polling should fire
    await act(async () => { await vi.advanceTimersByTimeAsync(30_001); });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/requests/42', expect.anything());
  });

  it('polling sees completed', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ status: 'completed', processedBy: 'api' }), { status: 200 }),
    );

    const { result } = renderHook(() => useRequestSSE(42));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_001); });
    expect(result.current.status).toBe('completed');
  });

  it('401 from polling sets errorReason=auth_expired', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }),
    );

    const { result } = renderHook(() => useRequestSSE(99));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_001); });
    expect(result.current.errorReason).toBe('auth_expired');
  });

  it('elapsedMs ticks up while in flight', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ status: 'processing', processedBy: null }), { status: 200 }),
    );

    const { result } = renderHook(() => useRequestSSE(77));
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(5_000);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(65_000);
  });

  it('SSE onmessage completed terminates polling', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ status: 'processing', processedBy: null }), { status: 200 }),
    );

    const { result } = renderHook(() => useRequestSSE(55));
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
