/**
 * useTripSegments debounce regression — Sentry #7475580989 N+1 fix
 *
 * drag-reorder / batch save flow 連 dispatch 多個 tp-entry-updated / tp-segment-updated
 * → 原本 handler 每次都觸發 fetch，5 個 event in < 500ms = 5 個 GET /segments → N+1。
 * Hook 內 200ms debounce 合併連發成單一 refetch。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTripSegments, type TripSegment } from '../../src/hooks/useTripSegments';
import { EVENT } from '../../src/lib/events';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
}));

const SEG: TripSegment = {
  id: 1, tripId: 't1', fromEntryId: 10, toEntryId: 20,
  mode: 'driving', min: 25, distanceM: 1000,
  source: 'google_routes', computedAt: 1, updatedAt: 1,
};

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockResolvedValue([SEG]);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useTripSegments — event refetch debounce', () => {
  it('5 個 entry-updated 在 200ms 內 dispatch → 合併為 1 個額外 fetch', async () => {
    renderHook(() => useTripSegments('t1'));

    await vi.waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    apiFetchMock.mockClear();

    act(() => {
      for (let i = 0; i < 5; i++) {
        window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: { tripId: 't1' } }));
      }
    });

    expect(apiFetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it('連 dispatch 後 unmount → 不發 fetch（cleanup 取消 debounce timer）', async () => {
    const { unmount } = renderHook(() => useTripSegments('t1'));

    await vi.waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    apiFetchMock.mockClear();

    act(() => {
      window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: { tripId: 't1' } }));
    });

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
