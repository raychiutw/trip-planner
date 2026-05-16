/**
 * TimelineRail × useTripSegments wiring (v2.24.0 Phase γ.1; v2.30.0 rewrite)
 *
 * 驗證：
 *   - TimelineRail 用 useTripId() → 給 hook tripId → segmentMap O(1) lookup
 *   - 每對 (prev, curr) entry 從 segmentMap 取對應 row 給 TravelPill
 *   - 有 segment + tripId → TravelPill 變 button（v2.24.0 interactive）
 *   - segment 不存在但 travelObj 在 → fallback 用 travelObj 唯讀渲染
 *   - 第一個 entry（i=0）→ 上方無 TravelPill
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimelineRail from '../../src/components/trip/TimelineRail';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';
import { TripIdContext } from '../../src/contexts/TripIdContext';

const useTripSegmentsMock = vi.fn();
vi.mock('../../src/hooks/useTripSegments', () => ({
  useTripSegments: (tripId: string | null | undefined) => useTripSegmentsMock(tripId),
}));

beforeEach(() => {
  useTripSegmentsMock.mockReset();
});

function entry(id: number, title: string, time = '09:00-10:00'): TimelineEntryData {
  return { id, time, title, description: null, note: null, googleRating: null };
}

function renderRail(events: TimelineEntryData[], tripId: string | null = 'trip-okinawa') {
  return render(
    <MemoryRouter>
      <TripIdContext.Provider value={tripId}>
        <TimelineRail events={events} />
      </TripIdContext.Provider>
    </MemoryRouter>,
  );
}

describe('TimelineRail × useTripSegments wiring', () => {
  it('passes tripId from context to useTripSegments hook', () => {
    useTripSegmentsMock.mockReturnValue({ segments: [], segmentMap: new Map(), loading: false });
    renderRail([entry(1, '那霸機場')], 'trip-okinawa');
    expect(useTripSegmentsMock).toHaveBeenCalledWith('trip-okinawa');
  });

  it('segment + tripId → TravelPill renders as interactive button with ▾', () => {
    const segMap = new Map([
      ['1-2', {
        id: 99, tripId: 'trip-okinawa', fromEntryId: 1, toEntryId: 2,
        mode: 'driving' as const, min: 25, distanceM: 18000, source: 'google_routes',
        computedAt: 1, updatedAt: 1,
      }],
    ]);
    useTripSegmentsMock.mockReturnValue({ segments: [], segmentMap: segMap, loading: false });

    renderRail([entry(1, '那霸機場'), entry(2, '本部午餐')]);

    const pills = screen.getAllByTestId('travel-pill');
    expect(pills).toHaveLength(1);
    expect(pills[0].tagName).toBe('BUTTON');
    expect(pills[0].textContent).toContain('▾');
    expect(pills[0].textContent).toContain('25 min');
  });

  it('segment.mode=transit → TravelPill 仍可點（v2.30 拔掉鎖頭概念）', () => {
    const segMap = new Map([
      ['1-2', {
        id: 99, tripId: 'trip-okinawa', fromEntryId: 1, toEntryId: 2,
        mode: 'transit' as const,
        min: 30, distanceM: null, source: 'manual',
        computedAt: 1, updatedAt: 1,
      }],
    ]);
    useTripSegmentsMock.mockReturnValue({ segments: [], segmentMap: segMap, loading: false });

    renderRail([entry(1, '那霸機場'), entry(2, '本部午餐')]);

    const pill = screen.getByTestId('travel-pill');
    expect(pill.tagName).toBe('BUTTON');
    expect(pill.textContent).toContain('▾');
    expect(pill.textContent).toContain('30 min');
  });

  it('multiple entry pairs → multiple TravelPills, each with own segment', () => {
    const segMap = new Map([
      ['1-2', {
        id: 10, tripId: 'trip-okinawa', fromEntryId: 1, toEntryId: 2,
        mode: 'walking' as const, min: 8, distanceM: 600, source: 'google_routes',
        computedAt: 1, updatedAt: 1,
      }],
      ['2-3', {
        id: 11, tripId: 'trip-okinawa', fromEntryId: 2, toEntryId: 3,
        mode: 'driving' as const, min: 22, distanceM: 15000, source: 'google_routes',
        computedAt: 1, updatedAt: 1,
      }],
    ]);
    useTripSegmentsMock.mockReturnValue({ segments: [], segmentMap: segMap, loading: false });

    renderRail([
      entry(1, '那霸機場'),
      entry(2, '美麗海'),
      entry(3, '本部午餐'),
    ]);

    const pills = screen.getAllByTestId('travel-pill');
    expect(pills).toHaveLength(2);
    expect(pills[0].textContent).toContain('8 min');
    expect(pills[1].textContent).toContain('22 min');
  });

  it('no segment + prev.travel exists → TravelPill 退回唯讀 div (v2.31.8 fix)', () => {
    // v2.31.8 fix: backend `entry.travel` 語意是 segmentsMap.get(from=eid)
    // = 「離開此 entry 到下一站」。UI pill 在 (prev → curr) 中間，意思是
    // 「抵達 curr 的旅程」= 「離開 prev」= `prev.travel`，所以 travel 要掛
    // 在 entry 1（那霸機場）上，pill 才正確顯示在 entry 2 上方。
    useTripSegmentsMock.mockReturnValue({ segments: [], segmentMap: new Map(), loading: false });

    const entryWithTravel: TimelineEntryData = {
      ...entry(1, '那霸機場'),
      travel: { type: 'driving', min: 25, distanceM: 18000, desc: null },
    };

    renderRail([entryWithTravel, entry(2, '本部午餐')]);

    const pill = screen.getByTestId('travel-pill');
    expect(pill.tagName).toBe('DIV');
    expect(pill).toHaveAttribute('role', 'presentation');
    expect(pill.textContent).toContain('25 min');
  });

  it('v2.31.8 regression: travel on curr (semantic mismatch) → no fallback pill', () => {
    // entry.travel on curr 是「離開 curr 到下一個」，UI pill 不該誤讀此值。
    // segments 未載入 + travel only on curr → no pill。
    useTripSegmentsMock.mockReturnValue({ segments: [], segmentMap: new Map(), loading: false });

    const entryWithTravel: TimelineEntryData = {
      ...entry(2, '本部午餐'),
      travel: { type: 'driving', min: 99, distanceM: 99000, desc: null },
    };

    renderRail([entry(1, '那霸機場'), entryWithTravel]);

    expect(screen.queryByTestId('travel-pill')).toBeNull();
  });

  it('no segment + no entry.travel → no TravelPill rendered', () => {
    useTripSegmentsMock.mockReturnValue({ segments: [], segmentMap: new Map(), loading: false });

    renderRail([entry(1, '那霸機場'), entry(2, '本部午餐')]);

    expect(screen.queryByTestId('travel-pill')).toBeNull();
  });

  it('first entry (i=0) → no TravelPill above it', () => {
    const segMap = new Map([
      ['1-2', {
        id: 99, tripId: 'trip-okinawa', fromEntryId: 1, toEntryId: 2,
        mode: 'driving' as const, min: 25, distanceM: 18000, source: 'google_routes',
        computedAt: 1, updatedAt: 1,
      }],
    ]);
    useTripSegmentsMock.mockReturnValue({ segments: [], segmentMap: segMap, loading: false });

    renderRail([entry(1, '那霸機場'), entry(2, '本部午餐')]);

    // 只該 render 一個 pill（在 entry 2 上方），entry 1 上方無
    expect(screen.getAllByTestId('travel-pill')).toHaveLength(1);
  });
});
