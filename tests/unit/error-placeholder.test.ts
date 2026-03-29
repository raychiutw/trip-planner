/**
 * 離線暫存 + 上線送出測試
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPendingReports } from '../../src/components/shared/ErrorPlaceholder';

const PENDING_KEY = 'pendingErrorReports';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('離線暫存 pendingErrorReports', () => {
  it('flushPendingReports — 無暫存時不呼叫 fetch', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    await flushPendingReports();
    expect(spy).not.toHaveBeenCalled();
  });

  it('flushPendingReports — 有暫存時送出並清除', async () => {
    const pending = [
      { tripId: 'trip-1', url: '/test', errorCode: 'SYS_INTERNAL', errorMessage: 'err', userAgent: 'ua', context: '{}', timestamp: new Date().toISOString() },
    ];
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 201 }));
    await flushPendingReports();

    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('flushPendingReports — fetch 失敗時保留暫存', async () => {
    const pending = [
      { tripId: 'trip-1', url: '/test', errorCode: 'SYS_INTERNAL', errorMessage: 'err', userAgent: 'ua', context: '{}', timestamp: new Date().toISOString() },
    ];
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await flushPendingReports();

    const remaining = JSON.parse(localStorage.getItem(PENDING_KEY)!);
    expect(remaining).toHaveLength(1);
  });

  it('flushPendingReports — 部分成功只保留失敗的', async () => {
    const pending = [
      { tripId: 'trip-1', url: '/a', errorCode: 'A', errorMessage: '', userAgent: '', context: '', timestamp: '' },
      { tripId: 'trip-2', url: '/b', errorCode: 'B', errorMessage: '', userAgent: '', context: '', timestamp: '' },
    ];
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));

    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(new Response('ok', { status: 201 }));
      return Promise.reject(new Error('fail'));
    });
    await flushPendingReports();

    const remaining = JSON.parse(localStorage.getItem(PENDING_KEY)!);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].tripId).toBe('trip-2');
  });
});
