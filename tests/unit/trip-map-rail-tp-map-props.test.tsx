/**
 * trip-map-rail-tp-map-props.test.tsx — runtime behavior contract after refactor
 *
 * TripMapRail is now a thin wrapper that delegates rendering to TpMap. This test
 * verifies the wrapper's public behavior:
 *   - Passes pins / pinsByDay / dark through to TpMap
 *   - onMarkerClick → navigate to /trip/:id/stop/:entryId for entry pins
 *   - IntersectionObserver on [data-day] → updates panToCoord prop
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EVENT } from '../../src/lib/events';

interface CapturedTpMapProps {
  pins?: unknown;
  pinsByDay?: Map<number, unknown>;
  dark?: boolean;
  panToCoord?: { lat: number; lng: number };
  onMarkerClick?: (id: number) => void;
  onPoiClick?: (poi: { placeId: string; lat: number; lng: number }) => void;
  onMapClick?: () => void;
  focusId?: number;
}

const tpMapCalls: CapturedTpMapProps[] = [];

vi.mock('../../src/hooks/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

// mock GooglePoiCard — 避開它 mount 時的 /places/resolve fetch，只驗「有沒有渲染」。
vi.mock('../../src/components/trip/GooglePoiCard', () => ({
  default: ({ poi }: { poi: { placeId: string } }) => (
    <div data-testid="trip-rail-google-poi-card">{poi.placeId}</div>
  ),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const orig = await importOriginal<typeof import('react-router-dom')>();
  return { ...orig, useNavigate: () => mockNavigate };
});

vi.mock('../../src/components/trip/TpMap', () => ({
  default: (props: CapturedTpMapProps) => {
    tpMapCalls.push(props);
    return null;
  },
}));

// IntersectionObserver capture — record the callback so we can fire it synchronously
type IOCallback = (entries: IntersectionObserverEntry[]) => void;
let capturedIOCallback: IOCallback | null = null;

class MockIntersectionObserver {
  constructor(callback: IOCallback) {
    capturedIOCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

const { default: TripMapRail } = await import('../../src/components/trip/TripMapRail');

const PINS_DAY1 = [
  { id: 101, type: 'entry' as const, index: 1, title: 'A', lat: 26.10, lng: 127.60, sortOrder: 0 },
  { id: 102, type: 'entry' as const, index: 2, title: 'B', lat: 26.20, lng: 127.70, sortOrder: 1 },
];
const PINS_BY_DAY = new Map([[1, PINS_DAY1]]);

describe('TripMapRail — TpMap wrapper contract', () => {
  beforeEach(() => {
    tpMapCalls.length = 0;
    mockNavigate.mockClear();
    capturedIOCallback = null;
  });

  it('passes all load-bearing props (pins, pinsByDay, dark, mode, routes, fillParent, fitOnce)', async () => {
    render(
      <MemoryRouter>
        <TripMapRail pins={PINS_DAY1} tripId="test-trip" pinsByDay={PINS_BY_DAY} dark={false} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(tpMapCalls.length).toBeGreaterThan(0));
    const props = tpMapCalls[tpMapCalls.length - 1]! as Record<string, unknown>;
    expect(props.pins).toBe(PINS_DAY1);
    expect(props.pinsByDay).toBe(PINS_BY_DAY);
    expect(props.dark).toBe(false);
    expect(props.mode).toBe('overview');
    expect(props.routes).toBe(true);
    expect(props.fillParent).toBe(true);
    // fitOnce is the guard against TripPage re-renders wiping user drag + scroll-spy pan
    expect(props.fitOnce).toBe(true);
    // cluster prop 已移除(2026-04-29 v2.17.13:user 拍板「地圖不要聚合」)
    expect(props).not.toHaveProperty('cluster');
  });

  it('propagates dark=true to TpMap', async () => {
    render(
      <MemoryRouter>
        <TripMapRail pins={PINS_DAY1} tripId="test-trip" pinsByDay={PINS_BY_DAY} dark={true} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(tpMapCalls.length).toBeGreaterThan(0));
    expect(tpMapCalls[tpMapCalls.length - 1]!.dark).toBe(true);
  });

  it('onMarkerClick navigates to /trip/:id/stop/:eid for entry pins', async () => {
    render(
      <MemoryRouter>
        <TripMapRail pins={PINS_DAY1} tripId="test-trip" pinsByDay={PINS_BY_DAY} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(tpMapCalls.length).toBeGreaterThan(0));
    const onClick = tpMapCalls[tpMapCalls.length - 1]!.onMarkerClick!;
    onClick(101);
    expect(mockNavigate).toHaveBeenCalledWith('/trip/test-trip/stop/101');
  });

  it('onMarkerClick does NOT navigate for hotel pins', async () => {
    const hotelPin = { id: 999, type: 'hotel' as const, index: 0, title: 'H', lat: 26.3, lng: 127.8, sortOrder: -1 };
    render(
      <MemoryRouter>
        <TripMapRail pins={[hotelPin]} tripId="test-trip" />
      </MemoryRouter>,
    );
    await waitFor(() => expect(tpMapCalls.length).toBeGreaterThan(0));
    const onClick = tpMapCalls[tpMapCalls.length - 1]!.onMarkerClick!;
    onClick(999);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('IntersectionObserver firing on [data-day] → panToCoord is set on TpMap', async () => {
    const section = document.createElement('section');
    section.setAttribute('data-day', '1');
    document.body.appendChild(section);

    render(
      <MemoryRouter>
        <TripMapRail pins={PINS_DAY1} tripId="test-trip" pinsByDay={PINS_BY_DAY} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(capturedIOCallback).not.toBeNull());

    act(() => {
      capturedIOCallback!([
        {
          isIntersecting: true,
          intersectionRatio: 0.8,
          target: section,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          time: 0,
        } as IntersectionObserverEntry,
      ]);
    });

    await waitFor(() => {
      const last = tpMapCalls[tpMapCalls.length - 1]!;
      expect(last.panToCoord).toBeDefined();
    });
    const last = tpMapCalls[tpMapCalls.length - 1]!;
    // Center is the average of the two entry pins in Day 1
    expect(last.panToCoord!.lat).toBeCloseTo(26.15, 2);
    expect(last.panToCoord!.lng).toBeCloseTo(127.65, 2);

    document.body.removeChild(section);
  });

  // ===== #1140-followup（owner 2026-07-24 grill）=====

  it('item 2/3：傳 onPoiClick + onMapClick 給 TpMap（才會開 clickableIcons）', async () => {
    render(
      <MemoryRouter>
        <TripMapRail pins={PINS_DAY1} tripId="test-trip" pinsByDay={PINS_BY_DAY} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(tpMapCalls.length).toBeGreaterThan(0));
    const props = tpMapCalls[tpMapCalls.length - 1]!;
    expect(typeof props.onPoiClick).toBe('function');
    expect(typeof props.onMapClick).toBe('function');
  });

  it('item 2/3：點 Google POI → 浮出 GooglePoiCard；onMapClick → 關閉', async () => {
    render(
      <MemoryRouter>
        <TripMapRail pins={PINS_DAY1} tripId="test-trip" pinsByDay={PINS_BY_DAY} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(tpMapCalls.length).toBeGreaterThan(0));
    expect(screen.queryByTestId('trip-rail-google-poi-card')).toBeNull();
    act(() => {
      tpMapCalls[tpMapCalls.length - 1]!.onPoiClick!({ placeId: 'PLACE_X', lat: 26.1, lng: 127.6 });
    });
    expect(screen.getByTestId('trip-rail-google-poi-card').textContent).toBe('PLACE_X');
    // POI 選取時解除行程 stop focus（互斥，同地圖頁）
    expect(tpMapCalls[tpMapCalls.length - 1]!.focusId).toBeUndefined();
    act(() => {
      tpMapCalls[tpMapCalls.length - 1]!.onMapClick!();
    });
    expect(screen.queryByTestId('trip-rail-google-poi-card')).toBeNull();
  });

  it('item 1：收合 stop 後，scroll-spy 的 IntersectionObserver 誤觸不再 pan（地圖原地不動）', async () => {
    const section = document.createElement('section');
    section.setAttribute('data-day', '1');
    document.body.appendChild(section);

    render(
      <MemoryRouter>
        <TripMapRail pins={PINS_DAY1} tripId="test-trip" pinsByDay={PINS_BY_DAY} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(capturedIOCallback).not.toBeNull());

    const fireIO = () => act(() => {
      capturedIOCallback!([
        { isIntersecting: true, intersectionRatio: 0.8, target: section,
          boundingClientRect: {} as DOMRectReadOnly, intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null, time: 0 } as IntersectionObserverEntry,
      ]);
    });

    // 先確認正常情況 scroll-spy 會 pan
    fireIO();
    await waitFor(() => expect(tpMapCalls[tpMapCalls.length - 1]!.panToCoord).toBeDefined());

    // 收合 stop → 清 panToCoord + 開啟抑制窗
    act(() => {
      window.dispatchEvent(new CustomEvent(EVENT.entryFocused, { detail: { entryId: 101, isExpanding: false } }));
    });
    await waitFor(() => expect(tpMapCalls[tpMapCalls.length - 1]!.panToCoord).toBeUndefined());

    // 收合後版面位移造成的 IO 誤觸 → 抑制窗內不 pan（panToCoord 維持 undefined）
    fireIO();
    expect(tpMapCalls[tpMapCalls.length - 1]!.panToCoord).toBeUndefined();

    document.body.removeChild(section);
  });

  it('item 1：展開 stop → focusId 設定（飛過去）且清掉 Google POI 卡', async () => {
    render(
      <MemoryRouter>
        <TripMapRail pins={PINS_DAY1} tripId="test-trip" pinsByDay={PINS_BY_DAY} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(tpMapCalls.length).toBeGreaterThan(0));
    // 先選一個 Google POI
    act(() => {
      tpMapCalls[tpMapCalls.length - 1]!.onPoiClick!({ placeId: 'PLACE_Y', lat: 26.1, lng: 127.6 });
    });
    expect(screen.getByTestId('trip-rail-google-poi-card')).toBeTruthy();
    // 展開 stop → focusId=101 + POI 卡消失
    act(() => {
      window.dispatchEvent(new CustomEvent(EVENT.entryFocused, { detail: { entryId: 101, isExpanding: true } }));
    });
    await waitFor(() => expect(tpMapCalls[tpMapCalls.length - 1]!.focusId).toBe(101));
    expect(screen.queryByTestId('trip-rail-google-poi-card')).toBeNull();
  });
});
