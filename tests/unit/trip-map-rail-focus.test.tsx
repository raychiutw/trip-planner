/**
 * trip-map-rail-focus.test.tsx — TDD tests for Item 3 (pin → navigate to stop)
 *
 * This tests the behaviour that clicking a pin triggers navigate to stop detail.
 * Since Leaflet is rendered in JSDOM (no real map), we verify the component
 * renders and the navigation function is properly wired.
 *
 * Tests:
 * - Component renders the container element when ≥1024px
 * - The component accepts pins with entry type and tripId
 * - useNavigate is called when a mock pin click handler fires
 *
 * F006: 補充 integration case — fake Leaflet map + marker，驗證 click → navigate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/* ===== mock useMediaQuery to always return desktop ===== */
vi.mock('../../src/hooks/useMediaQuery', () => ({
  useMediaQuery: () => true, // always ≥1024px
}));

/* ===== mock navigate ===== */
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const orig = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...orig,
    useNavigate: () => mockNavigate,
  };
});

/* ===== F006: fake Leaflet marker that records click handlers ===== */
type ClickHandler = () => void;
const markerClickHandlers: ClickHandler[] = [];

const fakeMarker = {
  addTo: vi.fn().mockReturnThis(),
  on: vi.fn((event: string, handler: ClickHandler) => {
    if (event === 'click') markerClickHandlers.push(handler);
    return fakeMarker;
  }),
  remove: vi.fn(),
};

const fakePolyline = {
  addTo: vi.fn().mockReturnThis(),
  remove: vi.fn(),
};

const fakeMap = {
  on: vi.fn(),
  off: vi.fn(),
  remove: vi.fn(),
  getZoom: () => 10,
  setView: vi.fn(),
  fitBounds: vi.fn(),
  eachLayer: vi.fn(),
  addLayer: vi.fn(),
};

vi.mock('leaflet', async (importOriginal) => {
  const orig = await importOriginal<typeof import('leaflet')>();
  return {
    ...orig,
    default: {
      ...orig,
      marker: vi.fn(() => fakeMarker),
      polyline: vi.fn(() => fakePolyline),
      divIcon: vi.fn(() => ({})),
    },
    marker: vi.fn(() => fakeMarker),
    polyline: vi.fn(() => fakePolyline),
    divIcon: vi.fn(() => ({})),
  };
});

/* ===== mock useLeafletMap — expose a fake marker click trigger ===== */
const mockFitBounds = vi.fn();
const mockFlyTo = vi.fn();
const containerRefObj = { current: null as HTMLDivElement | null };

vi.mock('../../src/hooks/useLeafletMap', () => ({
  useLeafletMap: (opts: Record<string, unknown>) => ({
    containerRef: containerRefObj,
    // 提供 fake map：讓 TripMapRail useEffect 不 early-return，marker 能被建立
    map: (opts as { dark?: boolean }).dark !== undefined ? fakeMap : null,
    flyTo: mockFlyTo,
    fitBounds: mockFitBounds,
  }),
}));

const { default: TripMapRail } = await import('../../src/components/trip/TripMapRail');

const ENTRY_PINS = [
  { id: 42, type: 'entry' as const, index: 1, title: '首里城', lat: 26.217, lng: 127.719, sortOrder: 0 },
  { id: 43, type: 'entry' as const, index: 2, title: '牧志市場', lat: 26.215, lng: 127.683, sortOrder: 1 },
];

describe('TripMapRail — renders container on desktop (Item 3)', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders .trip-map-rail container', () => {
    const { container } = render(
      <MemoryRouter>
        <TripMapRail pins={ENTRY_PINS} tripId="okinawa-trip-2026-Ray" />
      </MemoryRouter>,
    );
    expect(container.querySelector('.trip-map-rail')).not.toBeNull();
  });

  it('renders a div inside for the leaflet container ref', () => {
    const { container } = render(
      <MemoryRouter>
        <TripMapRail pins={ENTRY_PINS} tripId="okinawa-trip-2026-Ray" />
      </MemoryRouter>,
    );
    const rail = container.querySelector('.trip-map-rail');
    expect(rail?.querySelector('div')).not.toBeNull();
  });

  it('accepts empty pins array without crashing', () => {
    expect(() =>
      render(
        <MemoryRouter>
          <TripMapRail pins={[]} tripId="okinawa-trip-2026-Ray" />
        </MemoryRouter>,
      ),
    ).not.toThrow();
  });

  it('accepts hotel pins alongside entry pins', () => {
    const mixed = [
      ...ENTRY_PINS,
      { id: 99, type: 'hotel' as const, index: 0, title: 'Hotel', lat: 26.2, lng: 127.7, sortOrder: -1 },
    ];
    expect(() =>
      render(
        <MemoryRouter>
          <TripMapRail pins={mixed} tripId="okinawa-trip-2026-Ray" />
        </MemoryRouter>,
      ),
    ).not.toThrow();
  });
});

describe('F006 — TripMapRail marker click → navigate integration', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    markerClickHandlers.length = 0;
    fakeMarker.on.mockClear();
  });

  it('entry pin click 觸發 navigate 到 stop detail', () => {
    // dark prop 不是 undefined → useLeafletMap 回傳 fakeMap → effect 執行 → marker 被建立
    render(
      <MemoryRouter>
        <TripMapRail pins={ENTRY_PINS} tripId="okinawa-trip-2026-Ray" dark={false} />
      </MemoryRouter>,
    );

    // 找到第一個 entry pin 的 click handler 並觸發
    expect(markerClickHandlers.length).toBeGreaterThan(0);
    markerClickHandlers[0]?.();

    expect(mockNavigate).toHaveBeenCalledWith('/trip/okinawa-trip-2026-Ray/stop/42');
  });
});
