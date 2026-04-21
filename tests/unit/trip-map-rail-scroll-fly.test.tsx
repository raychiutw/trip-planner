/**
 * trip-map-rail-scroll-fly.test.tsx — F007 TDD red test
 *
 * 驗證 TripMapRail 在 day section 進入 viewport 時，
 * 會 call map.panTo 移動到該天的中心點。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/* ===== mock useMediaQuery — 永遠是 desktop ===== */
vi.mock('../../src/hooks/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

/* ===== mock navigate ===== */
vi.mock('react-router-dom', async (importOriginal) => {
  const orig = await importOriginal<typeof import('react-router-dom')>();
  return { ...orig, useNavigate: () => vi.fn() };
});

/* ===== mock leaflet ===== */
vi.mock('leaflet', async (importOriginal) => {
  const orig = await importOriginal<typeof import('leaflet')>();
  const fakeMarker = { addTo: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis(), remove: vi.fn() };
  const fakePolyline = { addTo: vi.fn().mockReturnThis(), remove: vi.fn() };
  return {
    ...orig,
    default: { ...orig, marker: vi.fn(() => fakeMarker), polyline: vi.fn(() => fakePolyline), divIcon: vi.fn(() => ({})) },
    marker: vi.fn(() => fakeMarker),
    polyline: vi.fn(() => fakePolyline),
    divIcon: vi.fn(() => ({})),
  };
});

/* ===== fake map with panTo spy ===== */
const mockPanTo = vi.fn();
const containerRefObj = { current: null as HTMLDivElement | null };

vi.mock('../../src/hooks/useLeafletMap', () => ({
  useLeafletMap: () => ({
    containerRef: containerRefObj,
    map: { on: vi.fn(), off: vi.fn(), eachLayer: vi.fn(), fitBounds: vi.fn(), setView: vi.fn(), panTo: mockPanTo },
    flyTo: vi.fn(),
    fitBounds: vi.fn(),
  }),
}));

/* ===== mock IntersectionObserver ===== */
type IOCallback = (entries: IntersectionObserverEntry[]) => void;
let capturedIOCallback: IOCallback | null = null;
let capturedIOTarget: Element | null = null;

class MockIntersectionObserver {
  constructor(callback: IOCallback) {
    capturedIOCallback = callback;
  }
  observe(el: Element) { capturedIOTarget = el; }
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

const { default: TripMapRail } = await import('../../src/components/trip/TripMapRail');

const PINS_DAY1 = [
  { id: 1, type: 'entry' as const, index: 1, title: '首里城', lat: 26.217, lng: 127.719, sortOrder: 0 },
  { id: 2, type: 'entry' as const, index: 2, title: '牧志', lat: 26.215, lng: 127.683, sortOrder: 1 },
];

const PINS_BY_DAY = new Map([[1, PINS_DAY1]]);

describe('F007 — TripMapRail scroll fly-to active day', () => {
  beforeEach(() => {
    mockPanTo.mockClear();
    capturedIOCallback = null;
    capturedIOTarget = null;
  });

  it('day section 進入 viewport 時 map.panTo 被呼叫', () => {
    // 建一個假的 day-section DOM element
    const daySection = document.createElement('section');
    daySection.setAttribute('data-day', '1');
    document.body.appendChild(daySection);

    render(
      <MemoryRouter>
        <TripMapRail pins={PINS_DAY1} tripId="test" pinsByDay={PINS_BY_DAY} dark={false} />
      </MemoryRouter>,
    );

    // 模擬 IntersectionObserver 回調：day 1 section 進入視野
    if (capturedIOCallback) {
      capturedIOCallback([
        {
          isIntersecting: true,
          intersectionRatio: 0.8,
          target: daySection,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          time: 0,
        } as IntersectionObserverEntry,
      ]);
    }

    // panTo 應被呼叫（以 day 1 pins 的平均座標）
    expect(mockPanTo).toHaveBeenCalled();

    document.body.removeChild(daySection);
  });
});
