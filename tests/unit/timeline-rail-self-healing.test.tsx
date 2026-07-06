/**
 * TimelineRail self-healing 車程補算（2026-07-06 車程重算缺口修正）
 *
 * 刪除/搬日/複製/後端直寫（AI chat、import、CLI）後，新相鄰 pair 缺 segment
 * row 或 computed_at=NULL。TimelineRail render 時偵測缺口 → 自動 day-scoped
 * requestTravelRecompute({ auto: true })。
 *
 * 驗證：
 *   - ready + 缺 pair → auto recompute（帶正確 dayNum scope）
 *   - ready + computed_at=NULL → auto recompute
 *   - ready + segmentMap 完整 → 不打
 *   - !ready（首次 fetch 未 settle）→ 不打（防空 map 誤判白燒 quota）
 *   - 無 tripId → 不打
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimelineRail from '../../src/components/trip/TimelineRail';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';
import { TripIdContext } from '../../src/contexts/TripIdContext';
import { TripDaysContext } from '../../src/contexts/TripDaysContext';
import type { DayOption } from '../../src/lib/entryAction';

const useTripSegmentsMock = vi.fn();
vi.mock('../../src/hooks/useTripSegments', () => ({
  useTripSegments: (tripId: string | null | undefined) => useTripSegmentsMock(tripId),
}));

const recomputeMock = vi.fn(() => Promise.resolve(null));
vi.mock('../../src/lib/travelRecompute', () => ({
  requestTravelRecompute: (
    tripId: string,
    dayNum?: number | null,
    opts?: { auto?: boolean; signature?: string },
  ) => recomputeMock(tripId, dayNum, opts),
}));

beforeEach(() => {
  useTripSegmentsMock.mockReset();
  recomputeMock.mockClear();
});

function entry(id: number, title: string, time = '09:00-10:00'): TimelineEntryData {
  // masterLat/masterLng：self-healing 只對「兩端都有座標」的 pair 觸發
  // （缺座標 pair backend 也算不出來，觸發只會白燒）
  return {
    id, time, title, description: null, note: null, googleRating: null,
    masterLat: 26.2 + id * 0.01, masterLng: 127.68 + id * 0.01,
  };
}

function entryNoCoord(id: number, title: string): TimelineEntryData {
  return { id, time: '09:00-10:00', title, description: null, note: null, googleRating: null, masterLat: null, masterLng: null };
}

function seg(from: number, to: number, computedAt: number | null = 1) {
  return {
    id: from * 100 + to, tripId: 't1', fromEntryId: from, toEntryId: to,
    mode: 'driving' as const, min: 25, distanceM: 18000, source: 'google',
    computedAt, updatedAt: 1,
  };
}

const DAYS: DayOption[] = [
  { dayId: 55, dayNum: 3, label: 'Day 3', stopCount: 2, swatchColor: '#ccc' },
];

function renderRail(
  events: TimelineEntryData[],
  { tripId = 't1', dayId = 55 as number | undefined }: { tripId?: string | null; dayId?: number } = {},
) {
  return render(
    <MemoryRouter>
      <TripIdContext.Provider value={tripId}>
        <TripDaysContext.Provider value={DAYS}>
          <TimelineRail events={events} dayId={dayId} />
        </TripDaysContext.Provider>
      </TripIdContext.Provider>
    </MemoryRouter>,
  );
}

describe('TimelineRail self-healing 車程補算', () => {
  it('ready + 相鄰 pair 缺 segment → auto day-scoped recompute 帶 gap signature', () => {
    useTripSegmentsMock.mockReturnValue({
      segments: [], segmentMap: new Map(), loading: false, ready: true,
    });
    renderRail([entry(1, '那霸機場'), entry(2, '美麗海')]);
    expect(recomputeMock).toHaveBeenCalledTimes(1);
    expect(recomputeMock).toHaveBeenCalledWith('t1', 3, { auto: true, signature: '1-2' });
  });

  it('ready + segment 在但 computed_at=NULL（換 POI mark stale）→ auto recompute', () => {
    const segMap = new Map([['1-2', seg(1, 2, null)]]);
    useTripSegmentsMock.mockReturnValue({
      segments: [], segmentMap: segMap, loading: false, ready: true,
    });
    renderRail([entry(1, '那霸機場'), entry(2, '美麗海')]);
    expect(recomputeMock).toHaveBeenCalledTimes(1);
  });

  it('ready + segmentMap 完整 → 不打', () => {
    const segMap = new Map([['1-2', seg(1, 2)], ['2-3', seg(2, 3)]]);
    useTripSegmentsMock.mockReturnValue({
      segments: [], segmentMap: segMap, loading: false, ready: true,
    });
    renderRail([entry(1, '那霸機場'), entry(2, '美麗海'), entry(3, '本部午餐')]);
    expect(recomputeMock).not.toHaveBeenCalled();
  });

  it('!ready（首次 fetch 未 settle）→ 空 map 不觸發（防白燒 quota）', () => {
    useTripSegmentsMock.mockReturnValue({
      segments: [], segmentMap: new Map(), loading: true, ready: false,
    });
    renderRail([entry(1, '那霸機場'), entry(2, '美麗海')]);
    expect(recomputeMock).not.toHaveBeenCalled();
  });

  it('單一 entry（無 pair）→ 不打', () => {
    useTripSegmentsMock.mockReturnValue({
      segments: [], segmentMap: new Map(), loading: false, ready: true,
    });
    renderRail([entry(1, '那霸機場')]);
    expect(recomputeMock).not.toHaveBeenCalled();
  });

  it('dayId 對不到 allDays（無 dayNum）→ auto 不打（不能放大成全 trip recompute）', () => {
    useTripSegmentsMock.mockReturnValue({
      segments: [], segmentMap: new Map(), loading: false, ready: true,
    });
    renderRail([entry(1, '那霸機場'), entry(2, '美麗海')], { dayId: 999 });
    expect(recomputeMock).not.toHaveBeenCalled();
  });

  it('缺座標 pair 不觸發 auto（backend 也算不出，白燒全日 quota）— 但 ⚠ affordance 仍在', () => {
    useTripSegmentsMock.mockReturnValue({
      segments: [], segmentMap: new Map(), loading: false, ready: true,
    });
    const { getAllByTestId } = renderRail([entryNoCoord(1, '手動地點'), entryNoCoord(2, '另一手動地點')]);
    expect(recomputeMock).not.toHaveBeenCalled();
    // recovery affordance 不因 auto skip 而消失
    expect(getAllByTestId('travel-pill-stale')).toHaveLength(1);
  });

  it('混合：有座標 pair 缺 segment + 缺座標 pair → 只以有座標缺口當 signature', () => {
    useTripSegmentsMock.mockReturnValue({
      segments: [], segmentMap: new Map(), loading: false, ready: true,
    });
    renderRail([entry(1, 'A'), entry(2, 'B'), entryNoCoord(3, 'C')]);
    expect(recomputeMock).toHaveBeenCalledTimes(1);
    expect(recomputeMock).toHaveBeenCalledWith('t1', 3, { auto: true, signature: '1-2' });
  });

  it('無 tripId → 不打', () => {
    useTripSegmentsMock.mockReturnValue({
      segments: [], segmentMap: new Map(), loading: false, ready: true,
    });
    renderRail([entry(1, '那霸機場'), entry(2, '美麗海')], { tripId: null });
    expect(recomputeMock).not.toHaveBeenCalled();
  });

  it('缺 pair 且無 legacy travel → 仍 render TravelPill ⚠（recovery affordance 不消失）', () => {
    useTripSegmentsMock.mockReturnValue({
      segments: [], segmentMap: new Map(), loading: false, ready: true,
    });
    const { getAllByTestId } = renderRail([entry(1, '那霸機場'), entry(2, '美麗海')]);
    // missing pair → TravelPill 以 stale 形式 render（⚠ 車程未更新 + 重新計算鈕）
    expect(getAllByTestId('travel-pill-stale')).toHaveLength(1);
    expect(getAllByTestId('travel-pill-recompute')).toHaveLength(1);
  });

  it('segments 未 ready → 不 render missing ⚠（載入期不閃）', () => {
    useTripSegmentsMock.mockReturnValue({
      segments: [], segmentMap: new Map(), loading: true, ready: false,
    });
    const { queryByTestId } = renderRail([entry(1, '那霸機場'), entry(2, '美麗海')]);
    expect(queryByTestId('travel-pill-stale')).toBeNull();
  });
});
