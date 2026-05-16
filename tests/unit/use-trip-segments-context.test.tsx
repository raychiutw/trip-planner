/**
 * useTripSegments × TripSegmentsContext — N+1 fix regression
 *
 * v2.31.x：TripPage 把 useTripSegments hoist 到自己，children TimelineRail
 * 透過 TripSegmentsContext 共用 segmentMap，避免 5-day trip 平行打 5 個
 * GET /api/trips/:id/segments。
 *
 * 驗證：
 *   - context provided → multiple hook callers 共用值，不會 fetch
 *   - context absent → 退回 hook 自己 fetch（EditEntryPage 等獨立頁面）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { useTripSegments, type TripSegment } from '../../src/hooks/useTripSegments';
import { TripSegmentsContext, type TripSegmentsContextValue } from '../../src/contexts/TripSegmentsContext';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
}));

beforeEach(() => {
  apiFetchMock.mockReset();
});

function buildSegments(): TripSegment[] {
  return [
    { id: 1, tripId: 't1', fromEntryId: 10, toEntryId: 20, mode: 'driving',
      min: 25, distanceM: 18000, source: 'google_routes', computedAt: 1, updatedAt: 1 },
  ];
}

describe('useTripSegments × TripSegmentsContext (N+1 fix)', () => {
  it('context provided → no fetch fired, segmentMap from context', async () => {
    const segs = buildSegments();
    const segMap = new Map([['10-20', segs[0]]]);
    const ctxValue: TripSegmentsContextValue = { segments: segs, segmentMap: segMap, loading: false };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <TripSegmentsContext.Provider value={ctxValue}>{children}</TripSegmentsContext.Provider>
    );

    const { result } = renderHook(() => useTripSegments('t1'), { wrapper });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.segments).toBe(segs);
    expect(result.current.segmentMap.get('10-20')?.min).toBe(25);
  });

  it('multiple hook instances under same context → still no extra fetch', async () => {
    const segs = buildSegments();
    const ctxValue: TripSegmentsContextValue = {
      segments: segs,
      segmentMap: new Map([['10-20', segs[0]]]),
      loading: false,
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TripSegmentsContext.Provider value={ctxValue}>{children}</TripSegmentsContext.Provider>
    );

    renderHook(() => useTripSegments('t1'), { wrapper });
    renderHook(() => useTripSegments('t1'), { wrapper });
    renderHook(() => useTripSegments('t1'), { wrapper });

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('context absent → hook fetches itself (EditEntryPage path)', async () => {
    apiFetchMock.mockResolvedValueOnce(buildSegments());

    const { result } = renderHook(() => useTripSegments('t1'));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    expect(apiFetchMock.mock.calls[0][0]).toBe('/trips/t1/segments');
    await waitFor(() => expect(result.current.segmentMap.get('10-20')?.min).toBe(25));
  });
});
