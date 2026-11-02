/**
 * useRequestSSE 的新 api 認證模式（VITE_NEW_API_AUTH=1）與旗標關閉時的隔離。
 *
 * - 旗標關閉：行為與原本完全一致（既有的 use-request-sse.test.tsx 負責細節），這裡只證明「不碰新東西」：
 *   不打新 api、不碰 IndexedDB、typed client 的模組根本沒被載入。
 * - 旗標開啟：換 ticket → 連 ?ticket=；reconnect／onerror 重新換票；polling 走新 api；auth 失效回報 auth_expired。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const clientLoaded = vi.hoisted(() => ({ count: 0 }));
vi.mock('../../src/lib/api/client', async (importOriginal) => {
  clientLoaded.count += 1;
  return importOriginal();
});

const authApiFetch = vi.hoisted(() => ({ fn: vi.fn() }));
const refreshFn = vi.hoisted(() => ({ fn: vi.fn(async () => undefined) }));
vi.mock('../../src/lib/auth', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../src/lib/auth')>();
  return {
    ...orig,
    getNewApiAuth: () => (orig.isNewApiAuthEnabled() ? { apiFetch: authApiFetch.fn, refresh: refreshFn.fn } : null),
  };
});

import { useRequestSSE } from '../../src/hooks/useRequestSSE';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  init?: EventSourceInit;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  listeners = new Map<string, (ev: { data: string }) => void>();
  closed = false;
  constructor(url: string, init?: EventSourceInit) { this.url = url; this.init = init; FakeEventSource.instances.push(this); }
  addEventListener(t: string, fn: (ev: { data: string }) => void) { this.listeners.set(t, fn); }
  close() { this.closed = true; }
}

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
let ticketN = 0;
let ticketResponder: () => Response;
let pollResponder: () => Response;
const calls: string[] = [];

const origES = globalThis.EventSource;
const idbAccess = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.instances = [];
  (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
  globalThis.fetch = vi.fn(async () => json({ status: 'processing', processedBy: null })) as unknown as typeof fetch;
  calls.length = 0;
  ticketN = 0;
  ticketResponder = () => json({ ticket: `tk${++ticketN}`, expires_in: 30 });
  pollResponder = () => json({ status: 'processing', processedBy: null });
  authApiFetch.fn.mockReset();
  authApiFetch.fn.mockImplementation(async (input: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${input}`);
    if (input.endsWith('/sse-ticket')) return ticketResponder();
    return pollResponder();
  });
  refreshFn.fn.mockClear();
  clientLoaded.count = 0;
  idbAccess.mockClear();
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, get: () => { idbAccess(); return undefined; } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  (globalThis as unknown as { EventSource: unknown }).EventSource = origES;
  // @ts-expect-error 測試中暫時定義的屬性
  delete globalThis.indexedDB;
});

const flush = () => act(async () => { await vi.dynamicImportSettled(); await vi.advanceTimersByTimeAsync(0); });
const enableFlag = () => { vi.stubEnv('VITE_NEW_API_AUTH', '1'); vi.stubEnv('VITE_API_BASE_URL', 'https://api.test'); };

describe('useRequestSSE — 旗標關閉（預設）', () => {
  it('走原本的 cookie 流程：withCredentials 的 EventSource、polling 走 apiFetchRaw', async () => {
    renderHook(() => useRequestSSE(42));
    await flush();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0]!.url).toMatch(/^(http:\/\/localhost:8788)?\/api\/requests\/42\/events$/);
    expect(FakeEventSource.instances[0]!.init).toEqual({ withCredentials: true });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/requests/42', expect.anything());
  });

  it('不打新 api、不碰 IndexedDB、typed client 模組沒有被載入', async () => {
    const { unmount } = renderHook(() => useRequestSSE(42));
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(authApiFetch.fn).not.toHaveBeenCalled();
    expect(idbAccess).not.toHaveBeenCalled();
    expect(clientLoaded.count).toBe(0);
    expect(FakeEventSource.instances.every((e) => !e.url.includes('ticket='))).toBe(true);
    unmount();
  });

  it('onerror 不 close（交給瀏覽器自動重連），與原本一致', async () => {
    renderHook(() => useRequestSSE(42));
    await flush();
    act(() => { FakeEventSource.instances[0]!.onerror?.(); });
    expect(FakeEventSource.instances[0]!.closed).toBe(false);
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});

describe('useRequestSSE — VITE_NEW_API_AUTH=1', () => {
  it('先換 ticket 再連 events?ticket=，不帶 cookie；typed client 此時才載入', async () => {
    enableFlag();
    const { result } = renderHook(() => useRequestSSE(42));
    await flush();
    expect(calls).toContain('POST /api/requests/42/sse-ticket');
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0]!.url).toBe('https://api.test/api/requests/42/events?ticket=tk1');
    expect(FakeEventSource.instances[0]!.init).toBeUndefined();
    expect(clientLoaded.count).toBe(1);
    act(() => { FakeEventSource.instances[0]!.onopen?.(); });
    expect(result.current.isConnected).toBe(true);
  });

  it('polling 走新 api（GET /api/requests/42），不再打 cookie 的舊路徑', async () => {
    enableFlag();
    renderHook(() => useRequestSSE(42));
    await flush();
    expect(calls).toContain('GET /api/requests/42');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('SSE 訊息照舊更新 status，completed 後關閉連線', async () => {
    enableFlag();
    const { result } = renderHook(() => useRequestSSE(42));
    await flush();
    act(() => { FakeEventSource.instances[0]!.onmessage?.({ data: JSON.stringify({ status: 'completed', processedBy: 'api' }) }); });
    expect(result.current.status).toBe('completed');
    expect(result.current.processedBy).toBe('api');
    expect(FakeEventSource.instances[0]!.closed).toBe(true);
  });

  it('reconnect 事件 → 重新換票並連線', async () => {
    enableFlag();
    renderHook(() => useRequestSSE(42));
    await flush();
    act(() => { FakeEventSource.instances[0]!.listeners.get('reconnect')?.({ data: '{"reason":"token_expired"}' }); });
    await flush();
    expect(calls.filter((c) => c === 'POST /api/requests/42/sse-ticket')).toHaveLength(2);
    expect(FakeEventSource.instances[1]!.url).toContain('ticket=tk2');
  });

  it('onerror → 自己關閉並（退避後）重新換票，不用已用過的 ticket', async () => {
    enableFlag();
    renderHook(() => useRequestSSE(42));
    await flush();
    act(() => { FakeEventSource.instances[0]!.onerror?.(); });
    expect(FakeEventSource.instances[0]!.closed).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[1]!.url).toContain('ticket=tk2');
  });

  it('grant_revoked 先 refresh() 再換票', async () => {
    enableFlag();
    renderHook(() => useRequestSSE(42));
    await flush();
    act(() => { FakeEventSource.instances[0]!.listeners.get('reconnect')?.({ data: '{"reason":"grant_revoked"}' }); });
    await flush();
    expect(refreshFn.fn).toHaveBeenCalledTimes(1);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('換票 401（登入失效）→ errorReason=auth_expired', async () => {
    enableFlag();
    ticketResponder = () => json({ error: { code: 'AUTH_REQUIRED', message: 'x' } }, 401);
    const { result } = renderHook(() => useRequestSSE(42));
    await flush();
    expect(result.current.errorReason).toBe('auth_expired');
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('unmount 後關閉連線，不再換票', async () => {
    enableFlag();
    const { unmount } = renderHook(() => useRequestSSE(42));
    await flush();
    act(() => { FakeEventSource.instances[0]!.onerror?.(); });
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(calls.filter((c) => c.endsWith('/sse-ticket'))).toHaveLength(1);
    expect(FakeEventSource.instances[0]!.closed).toBe(true);
  });

  it('換票前就 unmount：不建立連線', async () => {
    enableFlag();
    const { unmount } = renderHook(() => useRequestSSE(42));
    unmount();
    await flush();
    expect(FakeEventSource.instances).toHaveLength(0);
  });
});
