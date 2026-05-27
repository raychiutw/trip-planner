/**
 * apiClient 429 Retry-After parsing + 1 retry — v2.33.130 PR7 G10
 *
 * 只 retry idempotent methods (GET/HEAD)，避免 POST/PATCH/DELETE double-mutate。
 * Retry-After 支援 delta-seconds + HTTP-date 兩種 RFC 7231 形式，上限 30s。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseRetryAfter, apiFetch } from '../../src/lib/apiClient';

describe('parseRetryAfter — RFC 7231 forms', () => {
  it('null / empty → 0', () => {
    expect(parseRetryAfter(null)).toBe(0);
    expect(parseRetryAfter('')).toBe(0);
    expect(parseRetryAfter('   ')).toBe(0);
  });

  it('delta-seconds (整數秒) → ms', () => {
    expect(parseRetryAfter('5')).toBe(5000);
    expect(parseRetryAfter('0')).toBe(0);
    expect(parseRetryAfter('  10  ')).toBe(10000);
  });

  it('delta-seconds 上限 30s', () => {
    expect(parseRetryAfter('30')).toBe(30000);
    expect(parseRetryAfter('60')).toBe(30000);
    expect(parseRetryAfter('999999')).toBe(30000);
  });

  it('HTTP-date 未來 → 計算 delta', () => {
    const futureDate = new Date(Date.now() + 7000).toUTCString();
    const ms = parseRetryAfter(futureDate);
    expect(ms).toBeGreaterThan(5500);
    expect(ms).toBeLessThanOrEqual(7000);
  });

  it('HTTP-date 過去 → 0', () => {
    const pastDate = new Date(Date.now() - 10000).toUTCString();
    expect(parseRetryAfter(pastDate)).toBe(0);
  });

  it('HTTP-date 未來 > 30s → 上限 30000', () => {
    const farFuture = new Date(Date.now() + 60_000).toUTCString();
    expect(parseRetryAfter(farFuture)).toBe(30_000);
  });

  it('無效格式 → 0', () => {
    expect(parseRetryAfter('abc')).toBe(0);
    expect(parseRetryAfter('123abc')).toBe(0); // 不是純整數
  });
});

describe('apiFetch — 429 retry (GET idempotent)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('GET 429 → wait Retry-After → retry → 200 success', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'SYS_RATE_LIMIT' } }), {
          status: 429,
          headers: { 'Retry-After': '2' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    const promise = apiFetch<{ ok: boolean }>('/test');
    await vi.advanceTimersByTimeAsync(2100);
    const result = await promise;
    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('GET 429 → 第二次仍 429 → throw（只 retry 1 次）', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'SYS_RATE_LIMIT' } }), {
          status: 429,
          headers: { 'Retry-After': '1' },
        }),
      );

    const promise = apiFetch('/test');
    await vi.advanceTimersByTimeAsync(1100);
    await expect(promise).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('POST 429 → NOT retry（避免 double-mutate）', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'SYS_RATE_LIMIT' } }), {
        status: 429,
        headers: { 'Retry-After': '1' },
      }),
    );

    await expect(
      apiFetch('/test', { method: 'POST', body: '{}' }),
    ).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('PATCH 429 → NOT retry', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'SYS_RATE_LIMIT' } }), {
        status: 429,
      }),
    );
    await expect(
      apiFetch('/test', { method: 'PATCH', body: '{}' }),
    ).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('429 without Retry-After header → fallback 1s wait', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));

    const promise = apiFetch<{ ok: boolean }>('/test');
    await vi.advanceTimersByTimeAsync(1100);
    await promise;
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('signal abort 在 retry wait 期間 → throw without 2nd fetch', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('{}', {
        status: 429,
        headers: { 'Retry-After': '5' },
      }),
    );

    const ctrl = new AbortController();
    const promise = apiFetch('/test', { signal: ctrl.signal });
    ctrl.abort();
    await vi.advanceTimersByTimeAsync(5100);
    await expect(promise).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('200 success 不觸發 retry path', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    const result = await apiFetch<{ ok: boolean }>('/test');
    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
