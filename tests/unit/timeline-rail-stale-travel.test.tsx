/**
 * TimelineRail × stale-travel wiring — v2.29.2 rewrite
 *
 * 從 v2.28.1 Haversine 邏輯改成純 `segment.computedAt` 信號。新邏輯：
 *   - segment.computedAt = null → 渲染 ⚠ + 「重新計算」button
 *   - segment.computedAt 有值 → 不渲染 ⚠（不論 Haversine 跟 distance 差多少）
 *
 * Wiring 鏈：useTripSegments → segmentMap.get → TravelPill segment prop
 *           （含 computedAt field）→ TravelPill.isStale 判斷
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimelineRail from '../../src/components/trip/TimelineRail';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';
import { TripIdContext } from '../../src/contexts/TripIdContext';
import type { TripSegment } from '../../src/hooks/useTripSegments';
import { __resetTravelRecomputeState } from '../../src/lib/travelRecompute';

const useTripSegmentsMock = vi.fn();
vi.mock('../../src/hooks/useTripSegments', () => ({
  useTripSegments: (tripId: string | null | undefined) => useTripSegmentsMock(tripId),
}));

const apiFetchRawMock = vi.fn();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetchRaw: (...args: unknown[]) => apiFetchRawMock(...args),
  apiFetch: vi.fn(),
}));

beforeEach(() => {
  useTripSegmentsMock.mockReset();
  apiFetchRawMock.mockReset();
  // 本檔用真 travelRecompute helper（只 mock apiClient）— 清 module-level
  // single-flight / attempted state，避免跨測試 order-dependence
  __resetTravelRecomputeState();
});

function entry(id: number, title: string): TimelineEntryData {
  return {
    id,
    time: '09:00-10:00',
    title,
    description: null,
    note: null,
    googleRating: null,
    masterLat: null,
    masterLng: null,
    travel: null,
  };
}

function makeSegment(fromId: number, toId: number, computedAt: number | null): TripSegment {
  return {
    id: 100 + fromId * 10 + toId,
    tripId: 'trip-okinawa',
    fromEntryId: fromId,
    toEntryId: toId,
    mode: 'driving',
    min: 27,
    distanceM: 11299,
    source: 'google',
    computedAt,
    updatedAt: 1700000000000,
  };
}

function renderRail(events: TimelineEntryData[], segments: TripSegment[]) {
  const segmentMap = new Map<string, TripSegment>();
  for (const s of segments) segmentMap.set(`${s.fromEntryId}-${s.toEntryId}`, s);
  useTripSegmentsMock.mockReturnValue({ segments, segmentMap, loading: false });
  return render(
    <MemoryRouter>
      <TripIdContext.Provider value="trip-okinawa">
        <TimelineRail events={events} />
      </TripIdContext.Provider>
    </MemoryRouter>,
  );
}

describe('TimelineRail — v2.29.2 stale-travel ⚠ (computed_at) wiring', () => {
  it('segment.computedAt = null → 渲染 ⚠ + 重新計算 button', () => {
    renderRail(
      [entry(1, '那霸機場'), entry(2, '租車取車')],
      [makeSegment(1, 2, null)],
    );
    expect(screen.queryByTestId('travel-pill-stale')).toBeTruthy();
    expect(screen.queryByTestId('travel-pill-recompute')).toBeTruthy();
  });

  it('segment.computedAt 有值 → 不渲染 ⚠（即使 Haversine 跟 distanceM 差很多 — 道路 detour 不再誤觸發）', () => {
    // Ray S1 真實案例：機場→租車 直線 5.2km, 道路 11.3km（detour 2.2x = 54% divergence）
    // 舊邏輯誤標 stale；新邏輯只要 computedAt 有值就不警告
    renderRail(
      [entry(1, '那霸機場'), entry(2, '租車取車')],
      [makeSegment(1, 2, 1700000000000)],
    );
    expect(screen.queryByTestId('travel-pill-stale')).toBeNull();
  });

  it('沒 segment（純 legacy travel_*） → 不渲染 ⚠（沒 stale signal source）', () => {
    renderRail(
      [entry(1, '那霸機場'), entry(2, '租車取車')],
      [],
    );
    expect(screen.queryByTestId('travel-pill-stale')).toBeNull();
  });

  it('click 重新計算 → POST /trips/{id}/recompute-travel + tp-entry-updated event', async () => {
    apiFetchRawMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ pairsComputed: 1, pairsSkippedTransit: 0, pairsSkippedMissingCoords: 0, errorsDetail: [] }),
    } as unknown as Response);
    const eventSpy = vi.fn();
    window.addEventListener('tp-entry-updated', eventSpy);
    renderRail(
      [entry(1, '那霸機場'), entry(2, '租車取車')],
      [makeSegment(1, 2, null)],
    );
    fireEvent.click(screen.getByTestId('travel-pill-recompute'));
    const call = apiFetchRawMock.mock.calls.find((c) =>
      typeof c[0] === 'string' && (c[0] as string).includes('/recompute-travel'),
    );
    expect(call).toBeTruthy();
    expect((call![1] as RequestInit).method).toBe('POST');

    // v2.33.65 round 15: waitFor 取代 setTimeout(0) microtask flush (anti-pattern)
    await waitFor(() => expect(eventSpy).toHaveBeenCalled());
    window.removeEventListener('tp-entry-updated', eventSpy);
  });

  it('rapid double-click → 1 POST (in-flight guard via useRef)', async () => {
    let resolveFetch!: (v: Response) => void;
    apiFetchRawMock.mockReturnValue(new Promise<Response>((r) => { resolveFetch = r; }));
    renderRail(
      [entry(1, '那霸機場'), entry(2, '租車取車')],
      [makeSegment(1, 2, null)],
    );
    const btn = screen.getByTestId('travel-pill-recompute');
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    const recomputeCalls = apiFetchRawMock.mock.calls.filter((c) =>
      typeof c[0] === 'string' && (c[0] as string).includes('/recompute-travel'),
    );
    expect(recomputeCalls).toHaveLength(1);
    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({ pairsComputed: 1, pairsSkippedMissingCoords: 0, errorsDetail: [] }),
    } as unknown as Response);
    // v2.33.65 round 15: waitFor 取代 setTimeout(0) — 等 setState batch flush
    await waitFor(() => expect(apiFetchRawMock).toHaveBeenCalled());
  });

  it('failed POST → in-flight guard unlocks via .finally → retry POSTs again', async () => {
    apiFetchRawMock.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    apiFetchRawMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ pairsComputed: 1, pairsSkippedMissingCoords: 0, errorsDetail: [] }),
    } as unknown as Response);
    renderRail(
      [entry(1, '那霸機場'), entry(2, '租車取車')],
      [makeSegment(1, 2, null)],
    );
    const btn = screen.getByTestId('travel-pill-recompute');
    fireEvent.click(btn);
    // v2.33.65 round 15: waitFor 第一個 POST settle (失敗 unlock guard)
    await waitFor(() => expect(apiFetchRawMock).toHaveBeenCalledTimes(1));
    fireEvent.click(btn);
    await waitFor(() => {
      const recomputeCalls = apiFetchRawMock.mock.calls.filter((c) =>
        typeof c[0] === 'string' && (c[0] as string).includes('/recompute-travel'),
      );
      expect(recomputeCalls).toHaveLength(2);
    });
  });
});
