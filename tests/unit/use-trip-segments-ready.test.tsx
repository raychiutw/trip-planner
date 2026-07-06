/**
 * useTripSegments ready flag（2026-07-06 self-healing 的 quota-burn gate）
 *
 * ready 是 TimelineRail 自動補算唯一的「可以判斷缺 pair」信號：
 *   - 初始 false（首次 fetch 未 settle，空 map ≠ 真的沒 segment）
 *   - fetch 成功 → true
 *   - fetch 失敗 → 仍 false（transient read 失敗不能引發 write-side
 *     recompute — codex review P2；空 map 不是缺 pair 證據）
 *   - tripId 切換 → 降回 false（舊 trip 的 map 不能判斷新 trip）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTripSegments, type TripSegment } from '../../src/hooks/useTripSegments';

const apiFetchMock = vi.fn<(path: string) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string) => apiFetchMock(path),
}));

const SEG: TripSegment = {
  id: 1, tripId: 't1', fromEntryId: 10, toEntryId: 20,
  mode: 'driving', min: 25, distanceM: 1000,
  source: 'google', computedAt: 1, updatedAt: 1,
};

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('useTripSegments — ready flag', () => {
  it('初始 false → fetch 成功後 true', async () => {
    let resolve!: (v: unknown) => void;
    apiFetchMock.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { result } = renderHook(() => useTripSegments('t1'));
    expect(result.current.ready).toBe(false);

    resolve([SEG]);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.segments).toHaveLength(1);
  });

  it('fetch 失敗 → ready 保持 false（read 失敗不能餵 self-healing 空 map）', async () => {
    apiFetchMock.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useTripSegments('t1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ready).toBe(false);
    expect(result.current.segments).toHaveLength(0);
  });

  it('tripId 切換 → ready 降回 false，新 fetch 成功後再 true', async () => {
    apiFetchMock.mockResolvedValue([SEG]);
    const { result, rerender } = renderHook(
      ({ tripId }: { tripId: string }) => useTripSegments(tripId),
      { initialProps: { tripId: 't1' } },
    );
    await waitFor(() => expect(result.current.ready).toBe(true));

    let resolve!: (v: unknown) => void;
    apiFetchMock.mockReturnValue(new Promise((r) => { resolve = r; }));
    rerender({ tripId: 't2' });
    expect(result.current.ready).toBe(false);

    resolve([]);
    await waitFor(() => expect(result.current.ready).toBe(true));
  });

  it('無 tripId → 不 fetch，ready 保持 false', () => {
    const { result } = renderHook(() => useTripSegments(null));
    expect(result.current.ready).toBe(false);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
