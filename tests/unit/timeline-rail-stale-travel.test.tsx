/**
 * TimelineRail × stale-travel detection — v2.28.1
 *
 * 驗 TimelineRail 從 events.masterLat/masterLng 算 Haversine(prev, curr)，
 * 與 entry.travel.distanceM divergence > 20% 時透過 TravelPill 渲染 ⚠ + 「重新計算」。
 *
 * Why this is wired here, not just TravelPill：
 *   - TimelineRail 是 caller，負責 master coords 計算 + recompute callback。
 *   - 確保 mapDay → TimelineEntryData → TimelineRail → TravelPill 整條 props
 *     wire 起來，避免 prop name drift。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimelineRail from '../../src/components/trip/TimelineRail';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';
import { TripIdContext } from '../../src/contexts/TripIdContext';

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
});

function entryWithCoords(
  id: number,
  title: string,
  opts: {
    masterLat?: number | null;
    masterLng?: number | null;
    travelDistanceM?: number | null;
    travelMin?: number | null;
  } = {},
): TimelineEntryData {
  return {
    id,
    time: '09:00-10:00',
    title,
    description: null,
    note: null,
    googleRating: null,
    masterLat: opts.masterLat ?? null,
    masterLng: opts.masterLng ?? null,
    travel: opts.travelDistanceM != null || opts.travelMin != null
      ? {
          type: 'car',
          desc: null,
          min: opts.travelMin ?? null,
          distanceM: opts.travelDistanceM ?? null,
          text: '',
        }
      : null,
  };
}

function renderRail(events: TimelineEntryData[]) {
  useTripSegmentsMock.mockReturnValue({ segments: [], segmentMap: new Map(), loading: false });
  return render(
    <MemoryRouter>
      <TripIdContext.Provider value="trip-okinawa">
        <TimelineRail events={events} />
      </TripIdContext.Provider>
    </MemoryRouter>,
  );
}

describe('TimelineRail — v2.28.1 stale-travel ⚠ wiring', () => {
  it('master 座標跨區（沖繩→東京 ~1556 km）+ travel.distanceM 仍是舊值 400m → 渲染 ⚠', () => {
    renderRail([
      entryWithCoords(1, '那霸機場', { masterLat: 26.196, masterLng: 127.6458 }),
      entryWithCoords(2, 'Tokyo Tower', {
        masterLat: 35.6586, masterLng: 139.7454,
        travelDistanceM: 400, travelMin: 3,
      }),
    ]);
    expect(screen.queryByTestId('travel-pill-stale')).toBeTruthy();
    expect(screen.queryByTestId('travel-pill-recompute')).toBeTruthy();
  });

  it('master 座標在同區（沖繩內 ~17km）+ travel.distanceM 對齊 → 不渲染 ⚠', () => {
    renderRail([
      entryWithCoords(1, '那霸機場', { masterLat: 26.196, masterLng: 127.6458 }),
      entryWithCoords(2, '美國村', {
        masterLat: 26.3175, masterLng: 127.7539,
        travelDistanceM: 17000, travelMin: 25,
      }),
    ]);
    expect(screen.queryByTestId('travel-pill-stale')).toBeNull();
  });

  it('其中一筆 master 缺座標 → 不渲染 ⚠（caller 無法比較）', () => {
    renderRail([
      entryWithCoords(1, '那霸機場', { masterLat: null, masterLng: null }),
      entryWithCoords(2, 'Tokyo Tower', {
        masterLat: 35.6586, masterLng: 139.7454,
        travelDistanceM: 400, travelMin: 3,
      }),
    ]);
    expect(screen.queryByTestId('travel-pill-stale')).toBeNull();
  });

  it('click 重新計算 → POST /trips/{id}/recompute-travel + tp-entry-updated event', async () => {
    apiFetchRawMock.mockResolvedValue({ ok: true, status: 200 } as Response);
    const eventSpy = vi.fn();
    window.addEventListener('tp-entry-updated', eventSpy);
    renderRail([
      entryWithCoords(1, '那霸機場', { masterLat: 26.196, masterLng: 127.6458 }),
      entryWithCoords(2, 'Tokyo Tower', {
        masterLat: 35.6586, masterLng: 139.7454,
        travelDistanceM: 400, travelMin: 3,
      }),
    ]);
    fireEvent.click(screen.getByTestId('travel-pill-recompute'));
    // The endpoint URL is relative to apiClient; assert path + method
    const call = apiFetchRawMock.mock.calls.find((c) =>
      typeof c[0] === 'string' && (c[0] as string).includes('/recompute-travel'),
    );
    expect(call).toBeTruthy();
    expect((call![1] as RequestInit).method).toBe('POST');

    // Wait microtask for promise.then to dispatch the event
    await new Promise((r) => setTimeout(r, 0));
    expect(eventSpy).toHaveBeenCalled();
    window.removeEventListener('tp-entry-updated', eventSpy);
  });

  it('rapid double-click → 1 POST (in-flight guard via useRef)', async () => {
    let resolveFetch!: (v: Response) => void;
    apiFetchRawMock.mockReturnValue(new Promise<Response>((r) => { resolveFetch = r; }));
    renderRail([
      entryWithCoords(1, '那霸機場', { masterLat: 26.196, masterLng: 127.6458 }),
      entryWithCoords(2, 'Tokyo Tower', {
        masterLat: 35.6586, masterLng: 139.7454,
        travelDistanceM: 400, travelMin: 3,
      }),
    ]);
    const btn = screen.getByTestId('travel-pill-recompute');
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    // First call kicked off, others suppressed by ref guard
    const recomputeCalls = apiFetchRawMock.mock.calls.filter((c) =>
      typeof c[0] === 'string' && (c[0] as string).includes('/recompute-travel'),
    );
    expect(recomputeCalls).toHaveLength(1);
    resolveFetch({ ok: true, status: 200 } as Response);
    await new Promise((r) => setTimeout(r, 0));
  });

  it('failed POST → in-flight guard unlocks via .finally → retry POSTs again', async () => {
    apiFetchRawMock.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    apiFetchRawMock.mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    renderRail([
      entryWithCoords(1, '那霸機場', { masterLat: 26.196, masterLng: 127.6458 }),
      entryWithCoords(2, 'Tokyo Tower', {
        masterLat: 35.6586, masterLng: 139.7454,
        travelDistanceM: 400, travelMin: 3,
      }),
    ]);
    const btn = screen.getByTestId('travel-pill-recompute');
    fireEvent.click(btn);
    // First click resolves to 500, .finally unlocks ref
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(btn);
    await new Promise((r) => setTimeout(r, 0));
    const recomputeCalls = apiFetchRawMock.mock.calls.filter((c) =>
      typeof c[0] === 'string' && (c[0] as string).includes('/recompute-travel'),
    );
    expect(recomputeCalls).toHaveLength(2);
  });
});
