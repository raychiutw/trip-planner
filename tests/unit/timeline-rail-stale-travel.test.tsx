/**
 * TimelineRail × stale-travel wiring — v2.29.2 rewrite
 *
 * 從 v2.28.1 Haversine 邏輯改成純 `segment.computedAt` 信號。新邏輯：
 *   - segment.computedAt = null → 渲染「車程重新計算中」status chip
 *   - segment.computedAt 有值 → 不渲染 chip（不論 Haversine 跟 distance 差多少）
 *
 * 重算改由 self-healing 自動觸發（見 timeline-rail-self-healing.test）+ helper
 * single-flight（見 travel-recompute-helper.test），本檔只驗 chip 渲染 wiring：
 * useTripSegments → segmentMap.get → TravelPill segment prop → isStale 判斷。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('TimelineRail — v2.29.2 stale-travel status chip (computed_at) wiring', () => {
  it('segment.computedAt = null → 渲染「車程重新計算中」chip', () => {
    renderRail(
      [entry(1, '那霸機場'), entry(2, '租車取車')],
      [makeSegment(1, 2, null)],
    );
    const chip = screen.getByTestId('travel-pill-stale');
    expect(chip).toBeTruthy();
    expect(chip.textContent ?? '').toContain('車程重新計算中');
  });

  it('segment.computedAt 有值 → 不渲染 chip（即使 Haversine 跟 distanceM 差很多 — 道路 detour 不再誤觸發）', () => {
    // Ray S1 真實案例：機場→租車 直線 5.2km, 道路 11.3km（detour 2.2x = 54% divergence）
    // 舊邏輯誤標 stale；新邏輯只要 computedAt 有值就不警告
    renderRail(
      [entry(1, '那霸機場'), entry(2, '租車取車')],
      [makeSegment(1, 2, 1700000000000)],
    );
    expect(screen.queryByTestId('travel-pill-stale')).toBeNull();
  });

  it('沒 segment（純 legacy travel_*） → 不渲染 chip（沒 stale signal source）', () => {
    renderRail(
      [entry(1, '那霸機場'), entry(2, '租車取車')],
      [],
    );
    expect(screen.queryByTestId('travel-pill-stale')).toBeNull();
  });
});
