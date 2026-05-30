/**
 * PR1 — loadTripPrintData against the REAL `?all=1` contract.
 *
 * Code-review 2026-05-30 caught that the print loader was mapping assumed entry
 * fields (`time`/`title`/`rating` columns) that don't exist post-v2.29.0: time is
 * composed from startTime/endTime, title is `poiName ?? title`, rating lives on
 * the master stop POI, and travel.type arrives as `car`/`walk` (not driving/walking).
 * This test feeds that exact shape (no time/title/rating on the entry) so the
 * canonical `toTimelineEntry` mapping is verified end-to-end.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/apiClient', () => ({ apiFetch: vi.fn() }));
import { apiFetch } from '../../src/lib/apiClient';
import { loadTripPrintData, formatTravelLine } from '../../src/lib/tripPrintData';

const mockApi = apiFetch as unknown as ReturnType<typeof vi.fn>;

const META = { name: '沖繩', title: '沖繩 5 天 4 夜', destinations: [{ name: '那霸' }, { name: '美麗海' }] };
const RAW_DAYS = [
  {
    dayNum: 1,
    date: '2026-07-26',
    dayOfWeek: '六',
    timeline: [
      {
        // NOTE: no `time`, no `title`, no `rating` on the entry itself — exactly
        // what `?all=1` returns. They must come from startTime/endTime + master POI.
        id: 10,
        startTime: '09:00',
        endTime: '10:00',
        stopPois: [{ poiId: 1, sortOrder: 1, name: '那霸機場', type: 'transport', rating: 4.1 }],
        travel: { type: 'car', min: 12, distanceM: 2100 },
      },
    ],
    hotel: { name: '那霸東急 REI', rating: 4.2 },
  },
];
const NOTES = { flights: [{ airline: 'BR', flightNo: '112' }], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [] };

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockImplementation((path: string) => {
    if (path.endsWith('/notes')) return Promise.resolve(NOTES);
    if (path.includes('/days')) return Promise.resolve(RAW_DAYS);
    return Promise.resolve(META);
  });
});

describe('loadTripPrintData — real ?all=1 shape', () => {
  it('composes time from startTime/endTime (the `time` column is gone)', async () => {
    const d = await loadTripPrintData('t1');
    expect(d.days[0]!.timeline[0]!.time).toBe('09:00-10:00');
  });

  it('derives title from the master POI name when the entry title is absent', async () => {
    const d = await loadTripPrintData('t1');
    expect(d.days[0]!.timeline[0]!.title).toBe('那霸機場');
  });

  it('pulls rating from the master stop POI (not the entry)', async () => {
    const d = await loadTripPrintData('t1');
    expect(d.days[0]!.timeline[0]!.rating).toBe(4.1);
  });

  it('keeps raw backend travel type (car) and formats it to 開車', async () => {
    const d = await loadTripPrintData('t1');
    const travel = d.days[0]!.timeline[0]!.travel;
    expect(travel?.type).toBe('car');
    expect(formatTravelLine(travel)).toBe('開車 · 12 分 · 2.1km');
  });

  it('maps meta (title||name), destinations, dateRange, hotel and notes', async () => {
    const d = await loadTripPrintData('t1');
    expect(d.name).toBe('沖繩');
    expect(d.title).toBe('沖繩 5 天 4 夜');
    expect(d.destinations).toBe('那霸 · 美麗海');
    expect(d.dateRange).toBe('2026-07-26');
    expect(d.days[0]!.hotel?.name).toBe('那霸東急 REI');
    expect(d.notes.flights).toHaveLength(1);
  });

  it('survives a notes 404 (non-fatal → empty notes)', async () => {
    mockApi.mockImplementation((path: string) => {
      if (path.endsWith('/notes')) return Promise.reject(new Error('404'));
      if (path.includes('/days')) return Promise.resolve(RAW_DAYS);
      return Promise.resolve(META);
    });
    const d = await loadTripPrintData('t1');
    expect(d.notes.flights).toEqual([]);
    expect(d.days[0]!.timeline[0]!.title).toBe('那霸機場');
  });
});
