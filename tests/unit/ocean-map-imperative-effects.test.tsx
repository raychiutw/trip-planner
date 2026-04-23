/**
 * ocean-map-imperative-effects.test.tsx — runtime coverage for OceanMap
 * imperative useEffect hooks: panToCoord and fitOnce.
 *
 * These are the hooks TripMapRail relies on:
 *   - panToCoord: scroll spy pans map to day center without zoom change
 *   - fitOnce: first fitBounds runs, subsequent pins-identity changes are ignored
 *     (TripPage rebuilds pins inline on every render — without this guard the rail
 *     would snap back to full-trip bounds and wipe user drag + scroll-spy pan)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { MapPin } from '../../src/hooks/useMapData';

/* ===== mocks: useLeafletMap + Leaflet primitives ===== */

const panToSpy = vi.fn();
const fitBoundsSpy = vi.fn();
const flyToSpy = vi.fn();
const containerRefObj = { current: null as HTMLDivElement | null };

const fakeMap = {
  getZoom: () => 11,
  getBounds: () => ({ getWest: () => 0, getSouth: () => 0, getEast: () => 0, getNorth: () => 0 }),
  on: vi.fn(),
  off: vi.fn(),
  invalidateSize: vi.fn(),
  panTo: panToSpy,
};

vi.mock('../../src/hooks/useLeafletMap', () => ({
  useLeafletMap: () => ({
    containerRef: containerRefObj,
    map: fakeMap,
    flyTo: flyToSpy,
    fitBounds: fitBoundsSpy,
  }),
}));

vi.mock('../../src/hooks/useRoute', () => ({
  useRoute: () => null,
}));

vi.mock('leaflet', async (importOriginal) => {
  const orig = await importOriginal<typeof import('leaflet')>();
  const fakeLayer = { addTo: vi.fn().mockReturnThis(), remove: vi.fn(), clearLayers: vi.fn() };
  const fakeMarker = { addTo: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis(), remove: vi.fn(), setIcon: vi.fn() };
  return {
    ...orig,
    default: {
      ...orig,
      marker: vi.fn(() => fakeMarker),
      polyline: vi.fn(() => ({ addTo: vi.fn().mockReturnThis(), remove: vi.fn() })),
      divIcon: vi.fn(() => ({})),
      layerGroup: vi.fn(() => fakeLayer),
    },
    marker: vi.fn(() => fakeMarker),
    polyline: vi.fn(() => ({ addTo: vi.fn().mockReturnThis(), remove: vi.fn() })),
    divIcon: vi.fn(() => ({})),
    layerGroup: vi.fn(() => fakeLayer),
  };
});

const { default: OceanMap } = await import('../../src/components/trip/OceanMap');

const PINS: MapPin[] = [
  { id: 1, type: 'entry', index: 1, title: 'A', lat: 26.10, lng: 127.60, sortOrder: 0 },
  { id: 2, type: 'entry', index: 2, title: 'B', lat: 26.20, lng: 127.70, sortOrder: 1 },
];

describe('OceanMap — panToCoord useEffect', () => {
  beforeEach(() => {
    panToSpy.mockClear();
    fitBoundsSpy.mockClear();
    flyToSpy.mockClear();
  });

  it('calls map.panTo with [lat, lng] when panToCoord is set', () => {
    render(
      <OceanMap
        pins={PINS}
        mode="overview"
        panToCoord={{ lat: 26.15, lng: 127.65 }}
      />,
    );
    expect(panToSpy).toHaveBeenCalledWith([26.15, 127.65]);
  });

  it('does NOT call panTo when panToCoord is undefined', () => {
    render(<OceanMap pins={PINS} mode="overview" />);
    expect(panToSpy).not.toHaveBeenCalled();
  });

  it('calls panTo with new coord on rerender', () => {
    const { rerender } = render(
      <OceanMap pins={PINS} mode="overview" panToCoord={{ lat: 26.1, lng: 127.6 }} />,
    );
    expect(panToSpy).toHaveBeenCalledTimes(1);
    rerender(<OceanMap pins={PINS} mode="overview" panToCoord={{ lat: 26.3, lng: 127.8 }} />);
    expect(panToSpy).toHaveBeenCalledTimes(2);
    expect(panToSpy).toHaveBeenLastCalledWith([26.3, 127.8]);
  });
});

describe('OceanMap — fitOnce useEffect', () => {
  beforeEach(() => {
    panToSpy.mockClear();
    fitBoundsSpy.mockClear();
    flyToSpy.mockClear();
  });

  it('without fitOnce: fitBounds runs on every pins identity change', () => {
    const { rerender } = render(<OceanMap pins={PINS} mode="overview" />);
    const callsAfterMount = fitBoundsSpy.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0);
    // New pins array reference (TripPage rebuild simulation)
    rerender(<OceanMap pins={[...PINS]} mode="overview" />);
    expect(fitBoundsSpy.mock.calls.length).toBeGreaterThan(callsAfterMount);
  });

  it('fitOnce=true: fitBounds runs ONCE, subsequent pins identity changes ignored', () => {
    const { rerender } = render(<OceanMap pins={PINS} mode="overview" fitOnce={true} />);
    const callsAfterMount = fitBoundsSpy.mock.calls.length;
    expect(callsAfterMount).toBe(1);
    // Simulate TripPage re-render rebuilding pins inline
    rerender(<OceanMap pins={[...PINS]} mode="overview" fitOnce={true} />);
    rerender(<OceanMap pins={[...PINS]} mode="overview" fitOnce={true} />);
    expect(fitBoundsSpy.mock.calls.length).toBe(1);
  });
});
