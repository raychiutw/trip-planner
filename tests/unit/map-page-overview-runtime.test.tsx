/**
 * map-page-overview-runtime.test.tsx — runtime coverage for overview mode behaviours
 * that the source-level regex guards cannot catch.
 *
 * Covers:
 * 1. ?day=all without entryId → TpMap receives focusId=undefined
 *    (so it fitBounds the whole trip, instead of flyTo the first pin)
 * 2. ?day=all → TpMap receives pinsByDay and dayNum=undefined
 * 3. handleTabClick — clicking 總覽 writes ?day=all; clicking DAY 02 writes ?day=2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface CapturedTpMapProps {
  focusId?: number;
  pinsByDay?: Map<number, unknown>;
  dayNum?: number;
  zoomControlPosition?: string;
  onMarkerClick?: (id: number) => void;
}

// Capture TpMap props across renders
const tpMapCalls: CapturedTpMapProps[] = [];

vi.mock('react-router-dom', async (importOriginal) => {
  const orig = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...orig,
    useParams: () => ({ tripId: 'test-trip' }),
  };
});

const mockAllDays = {
  1: { dayNum: 1, date: '2026-07-29', label: '北谷', timeline: [
    { id: 1, sortOrder: 1, stopPois: [{ name: 'e1', type: 'place', lat: 26.1, lng: 127.6, sortOrder: 1 }] },
  ] },
  2: { dayNum: 2, date: '2026-07-30', label: '那覇', timeline: [
    { id: 2, sortOrder: 1, stopPois: [{ name: 'e2', type: 'place', lat: 26.2, lng: 127.7, sortOrder: 1 }] },
    { id: 3, sortOrder: 2, stopPois: [{ name: 'e3', type: 'place', lat: 26.3, lng: 127.8, sortOrder: 1 }] },
  ] },
  3: { dayNum: 3, date: '2026-07-31', label: '糸満', timeline: [
    { id: 4, sortOrder: 1, stopPois: [{ name: 'e4', type: 'place', lat: 26.4, lng: 127.9, sortOrder: 1 }] },
  ] },
};

vi.mock('../../src/contexts/TripContext', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../src/contexts/TripContext')>();
  return {
    ...orig,
    useTripContext: () => ({
      trip: { id: 'test-trip', title: 'Test Trip' },
      allDays: mockAllDays,
      loading: false,
      days: [],
      currentDay: undefined,
      currentDayNum: 1,
      switchDay: vi.fn(),
      refetchCurrentDay: vi.fn(),
      docs: [],
      error: null,
    }),
  };
});

// Props-capturing TpMap mock
vi.mock('../../src/components/trip/TpMap', () => ({
  default: (props: CapturedTpMapProps) => {
    tpMapCalls.push(props);
    return null;
  },
}));

vi.mock('../../src/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

// JSDOM lacks IntersectionObserver; MapPage uses it for card-scroll tracking.
class MockIntersectionObserver {
  constructor(_: unknown) {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
// JSDOM's Element has no scrollIntoView; MapPage calls it on card click + tab change.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

import { render, fireEvent, waitFor, act, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

async function mountMapPage(url: string) {
  const { default: MapPage } = await import('../../src/pages/MapPage');
  const result = render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/trip/:tripId/map" element={<MapPage />} />
      </Routes>
    </MemoryRouter>,
  );
  // TpMap is lazy() — wait until the mock has been invoked at least once
  await waitFor(() => expect(tpMapCalls.length).toBeGreaterThan(0));
  return result;
}

describe('MapPage overview runtime — fitBounds vs flyTo', () => {
  beforeEach(() => {
    tpMapCalls.length = 0;
  });

  it('?day=all without entryId: TpMap.focusId is undefined (→ fitBounds whole trip)', async () => {
    await mountMapPage('/trip/test-trip/map?day=all');
    // Find the last overview-mode call (with pinsByDay set)
    const overviewCalls = tpMapCalls.filter((p) => p.pinsByDay !== undefined);
    expect(overviewCalls.length).toBeGreaterThan(0);
    const last = overviewCalls[overviewCalls.length - 1]!;
    expect(last.focusId).toBeUndefined();
  });

  it('?day=all: TpMap receives pinsByDay and dayNum=undefined', async () => {
    await mountMapPage('/trip/test-trip/map?day=all');
    const overviewCalls = tpMapCalls.filter((p) => p.pinsByDay !== undefined);
    const last = overviewCalls[overviewCalls.length - 1]!;
    expect(last.pinsByDay).toBeInstanceOf(Map);
    expect(last.pinsByDay!.size).toBeGreaterThan(0);
    expect(last.dayNum).toBeUndefined();
  });

  it('keeps Google zoom controls on the opposite side from map action buttons', async () => {
    await mountMapPage('/trip/test-trip/map?day=all');
    expect(tpMapCalls[tpMapCalls.length - 1]!.zoomControlPosition).toBe('LEFT_CENTER');
  });

  it('?day=2: TpMap receives dayNum=2 and pinsByDay=undefined (single-day mode)', async () => {
    await mountMapPage('/trip/test-trip/map?day=2');
    const last = tpMapCalls[tpMapCalls.length - 1]!;
    expect(last.pinsByDay).toBeUndefined();
    expect(last.dayNum).toBe(2);
  });
});

describe('MapPage overview runtime — handleTabClick URL sync', () => {
  beforeEach(() => {
    tpMapCalls.length = 0;
  });

  it('clicking 總覽 tab switches TpMap to overview props (pinsByDay set, dayNum undefined)', async () => {
    const { getByText } = await mountMapPage('/trip/test-trip/map?day=1');
    // Initially single-day
    const initial = tpMapCalls[tpMapCalls.length - 1]!;
    expect(initial.dayNum).toBe(1);
    expect(initial.pinsByDay).toBeUndefined();

    // Click 總覽 tab
    fireEvent.click(getByText('總覽'));

    // After click: TpMap should now receive overview props
    const after = tpMapCalls[tpMapCalls.length - 1]!;
    expect(after.pinsByDay).toBeInstanceOf(Map);
    expect(after.dayNum).toBeUndefined();
  });

  it('clicking DAY 2 from overview switches TpMap to single-day props', async () => {
    const { getByText } = await mountMapPage('/trip/test-trip/map?day=all');
    // Initially overview
    expect(tpMapCalls[tpMapCalls.length - 1]!.pinsByDay).toBeInstanceOf(Map);

    // Click DAY 2
    fireEvent.click(getByText(/DAY 2\b/i));

    const after = tpMapCalls[tpMapCalls.length - 1]!;
    expect(after.pinsByDay).toBeUndefined();
    expect(after.dayNum).toBe(2);
  });

  it('selecting a day-two pin keeps that pin, card, and day selected', async () => {
    await mountMapPage('/trip/test-trip/map?day=all');

    act(() => tpMapCalls[tpMapCalls.length - 1]!.onMarkerClick?.(3));

    await waitFor(() => {
      expect(screen.getByTestId('map-day-2')).toHaveAttribute('aria-current', 'true');
      expect(screen.getByText('e3').closest('[data-card-entry-id]')).toHaveAttribute('aria-current', 'true');
      expect(tpMapCalls[tpMapCalls.length - 1]!.focusId).toBe(3);
    });
  });
});
