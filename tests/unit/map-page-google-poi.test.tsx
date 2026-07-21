/**
 * map-page-google-poi.test.tsx — TDD red test.
 *
 * owner 2026-07-21「地圖模式的地圖點選 Google POI 開啟在 POI tab，然後可以另開
 * Google Map 視窗，如同 Flutter」。驗證 MapPage 層的狀態機（對齊 Flutter
 * TripMapScreen 的 _selectedGooglePoi / _selectGooglePoi / _clearGooglePoi /
 * _selectStop 清 google poi 那段邏輯）：
 *
 *   1. 初始：顯示行程 POI 卡橫向捲動（既有）
 *   2. TpMap 觸發 onPoiClick → 底部插槽換成 GooglePoiCard（既有捲動卡隱藏）
 *   3. TpMap 觸發 onMapClick（點地圖空白處）→ 換回行程 POI 卡捲動
 *   4. GooglePoiCard 的 onClose → 換回行程 POI 卡捲動
 *   5. 點行程自己的 entry card（onMarkerClick 路徑）→ 清掉已選的 Google POI
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface CapturedTpMapProps {
  onPoiClick?: (poi: { placeId: string; lat: number; lng: number }) => void;
  onMapClick?: () => void;
  onMarkerClick?: (id: number) => void;
}
interface CapturedGooglePoiCardProps {
  poi: { placeId: string; lat: number; lng: number };
  onClose: () => void;
}

const tpMapCalls: CapturedTpMapProps[] = [];
const googlePoiCardCalls: CapturedGooglePoiCardProps[] = [];

vi.mock('react-router-dom', async (importOriginal) => {
  const orig = await importOriginal<typeof import('react-router-dom')>();
  return { ...orig, useParams: () => ({ tripId: 'test-trip' }) };
});

const mockAllDays = {
  1: { dayNum: 1, date: '2026-07-29', label: '北谷', entries: [] },
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

vi.mock('../../src/components/trip/TpMap', () => ({
  default: (props: CapturedTpMapProps) => {
    tpMapCalls.push(props);
    return (
      <div>
        <button
          type="button"
          data-testid="fire-poi-click"
          onClick={() => props.onPoiClick?.({ placeId: 'ChIJ-test', lat: 26.2, lng: 127.6 })}
        >
          fire poi click
        </button>
        <button type="button" data-testid="fire-map-click" onClick={() => props.onMapClick?.()}>
          fire map click
        </button>
        <button type="button" data-testid="fire-marker-click" onClick={() => props.onMarkerClick?.(1)}>
          fire marker click
        </button>
      </div>
    );
  },
}));

vi.mock('../../src/components/trip/GooglePoiCard', () => ({
  default: (props: CapturedGooglePoiCardProps) => {
    googlePoiCardCalls.push(props);
    return (
      <div data-testid="google-poi-card-mock">
        <button type="button" data-testid="close-google-poi" onClick={props.onClose}>close</button>
      </div>
    );
  },
}));

vi.mock('../../src/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));

class MockIntersectionObserver {
  constructor(_: unknown) {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

vi.mock('../../src/hooks/useMapData', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../src/hooks/useMapData')>();
  const fakePin = {
    id: 1, type: 'entry' as const, index: 1, title: 'e1',
    lat: 26.1, lng: 127.6, sortOrder: 0,
  };
  return {
    ...orig,
    extractPinsFromDay: () => ({ pins: [fakePin], missingCount: 0 }),
    extractPinsFromAllDays: () => ({
      pins: [fakePin],
      pinsByDay: new Map([[1, [fakePin]]]),
      missingCount: 0,
    }),
  };
});

import { render, fireEvent, waitFor, screen } from '@testing-library/react';
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
  await waitFor(() => expect(tpMapCalls.length).toBeGreaterThan(0));
  return result;
}

describe('MapPage — Google POI tap wiring', () => {
  beforeEach(() => {
    tpMapCalls.length = 0;
    googlePoiCardCalls.length = 0;
  });

  it('initial: shows the trip entry-card strip, no GooglePoiCard', async () => {
    await mountMapPage('/trip/test-trip/map?day=1');
    expect(screen.queryByTestId('google-poi-card-mock')).not.toBeInTheDocument();
  });

  it('TpMap onPoiClick → swaps in GooglePoiCard with the tapped poi', async () => {
    await mountMapPage('/trip/test-trip/map?day=1');
    fireEvent.click(screen.getByTestId('fire-poi-click'));
    await waitFor(() => expect(screen.getByTestId('google-poi-card-mock')).toBeInTheDocument());
    const last = googlePoiCardCalls[googlePoiCardCalls.length - 1]!;
    expect(last.poi).toEqual({ placeId: 'ChIJ-test', lat: 26.2, lng: 127.6 });
  });

  it('TpMap onMapClick (background tap) → clears GooglePoiCard, back to entry-card strip', async () => {
    await mountMapPage('/trip/test-trip/map?day=1');
    fireEvent.click(screen.getByTestId('fire-poi-click'));
    await waitFor(() => expect(screen.getByTestId('google-poi-card-mock')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('fire-map-click'));
    await waitFor(() => expect(screen.queryByTestId('google-poi-card-mock')).not.toBeInTheDocument());
  });

  it('GooglePoiCard onClose → clears selection, back to entry-card strip', async () => {
    await mountMapPage('/trip/test-trip/map?day=1');
    fireEvent.click(screen.getByTestId('fire-poi-click'));
    await waitFor(() => expect(screen.getByTestId('google-poi-card-mock')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('close-google-poi'));
    await waitFor(() => expect(screen.queryByTestId('google-poi-card-mock')).not.toBeInTheDocument());
  });

  it('selecting the trip\'s own stop (map pin tap → onMarkerClick) clears an already-selected Google POI', async () => {
    // Mirrors Flutter _selectStop clearing _selectedGooglePoi. The trip's entry-card
    // strip is hidden while a Google POI card is shown (same slot, mutually exclusive
    // per the mockup) — so the realistic trigger here is tapping the trip's own pin
    // on the map (TpMap.onMarkerClick), not the (hidden) entry card.
    await mountMapPage('/trip/test-trip/map?day=1');
    fireEvent.click(screen.getByTestId('fire-poi-click'));
    await waitFor(() => expect(screen.getByTestId('google-poi-card-mock')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('fire-marker-click'));
    await waitFor(() => expect(screen.queryByTestId('google-poi-card-mock')).not.toBeInTheDocument());
  });
});
