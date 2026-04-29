/**
 * trip-map-rail-ocean-map-props.test.tsx — runtime behavior contract after refactor
 *
 * TripMapRail is now a thin wrapper that delegates rendering to OceanMap. This test
 * verifies the wrapper's public behavior:
 *   - Passes pins / pinsByDay / dark through to OceanMap
 *   - onMarkerClick → navigate to /trip/:id/stop/:entryId for entry pins
 *   - IntersectionObserver on [data-day] → updates panToCoord prop
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

interface CapturedOceanMapProps {
  pins?: unknown;
  pinsByDay?: Map<number, unknown>;
  dark?: boolean;
  panToCoord?: { lat: number; lng: number };
  onMarkerClick?: (id: number) => void;
}

const oceanMapCalls: CapturedOceanMapProps[] = [];

vi.mock('../../src/hooks/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const orig = await importOriginal<typeof import('react-router-dom')>();
  return { ...orig, useNavigate: () => mockNavigate };
});

vi.mock('../../src/components/trip/OceanMap', () => ({
  default: (props: CapturedOceanMapProps) => {
    oceanMapCalls.push(props);
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

describe('TripMapRail — OceanMap wrapper contract', () => {
  beforeEach(() => {
    oceanMapCalls.length = 0;
    mockNavigate.mockClear();
    capturedIOCallback = null;
  });

  it('passes all load-bearing props (pins, pinsByDay, dark, mode, routes, fillParent, fitOnce)', async () => {
    render(
      <MemoryRouter>
        <TripMapRail pins={PINS_DAY1} tripId="test-trip" pinsByDay={PINS_BY_DAY} dark={false} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(oceanMapCalls.length).toBeGreaterThan(0));
    const props = oceanMapCalls[oceanMapCalls.length - 1]! as Record<string, unknown>;
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

  it('propagates dark=true to OceanMap', async () => {
    render(
      <MemoryRouter>
        <TripMapRail pins={PINS_DAY1} tripId="test-trip" pinsByDay={PINS_BY_DAY} dark={true} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(oceanMapCalls.length).toBeGreaterThan(0));
    expect(oceanMapCalls[oceanMapCalls.length - 1]!.dark).toBe(true);
  });

  it('onMarkerClick navigates to /trip/:id/stop/:eid for entry pins', async () => {
    render(
      <MemoryRouter>
        <TripMapRail pins={PINS_DAY1} tripId="test-trip" pinsByDay={PINS_BY_DAY} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(oceanMapCalls.length).toBeGreaterThan(0));
    const onClick = oceanMapCalls[oceanMapCalls.length - 1]!.onMarkerClick!;
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
    await waitFor(() => expect(oceanMapCalls.length).toBeGreaterThan(0));
    const onClick = oceanMapCalls[oceanMapCalls.length - 1]!.onMarkerClick!;
    onClick(999);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('IntersectionObserver firing on [data-day] → panToCoord is set on OceanMap', async () => {
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
      const last = oceanMapCalls[oceanMapCalls.length - 1]!;
      expect(last.panToCoord).toBeDefined();
    });
    const last = oceanMapCalls[oceanMapCalls.length - 1]!;
    // Center is the average of the two entry pins in Day 1
    expect(last.panToCoord!.lat).toBeCloseTo(26.15, 2);
    expect(last.panToCoord!.lng).toBeCloseTo(127.65, 2);

    document.body.removeChild(section);
  });
});
