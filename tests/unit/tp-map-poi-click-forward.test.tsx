/**
 * tp-map-poi-click-forward.test.tsx — TDD red test.
 *
 * owner 2026-07-21「地圖點選 Google POI」：TpMap 必須把 onPoiClick/onMapClick
 * 轉給 useGoogleMap，且只有呼叫端有給 onPoiClick 時才打開 clickableIcons
 * （否則沿用舊行為 — LocationPickerMap 等其他 useGoogleMap 呼叫端不受影響）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { UseGoogleMapOptions } from '../../src/hooks/useGoogleMap';

const useGoogleMapCalls: UseGoogleMapOptions[] = [];

vi.mock('../../src/hooks/useGoogleMap', () => ({
  useGoogleMap: (opts: UseGoogleMapOptions) => {
    useGoogleMapCalls.push(opts);
    return {
      containerRef: { current: null },
      map: null,
      loadError: null,
      flyTo: vi.fn(),
      fitBounds: vi.fn(),
    };
  },
}));

// TpMap also composes these hooks — no-op is fine (map is always null in this test).
vi.mock('../../src/hooks/useMapMarkers', () => ({ useMapMarkers: () => {} }));
vi.mock('../../src/hooks/useMapViewport', () => ({ useMapViewport: () => {} }));
vi.mock('../../src/hooks/useMapSegments', () => ({ useMapSegments: () => [] }));

const { default: TpMap } = await import('../../src/components/trip/TpMap');

const PINS = [
  { id: 1, type: 'entry' as const, index: 1, title: 'A', lat: 26.1, lng: 127.6, sortOrder: 0 },
];

describe('TpMap → useGoogleMap POI click forwarding', () => {
  beforeEach(() => {
    useGoogleMapCalls.length = 0;
  });

  it('no onPoiClick prop → clickableIcons NOT requested (existing callers unchanged)', () => {
    render(<TpMap pins={PINS} mode="overview" />);
    const opts = useGoogleMapCalls[useGoogleMapCalls.length - 1]!;
    expect(opts.clickableIcons).toBeFalsy();
    expect(opts.onPoiClick).toBeUndefined();
  });

  it('onPoiClick prop present → clickableIcons=true and callback forwarded verbatim', () => {
    const onPoiClick = vi.fn();
    render(<TpMap pins={PINS} mode="overview" onPoiClick={onPoiClick} />);
    const opts = useGoogleMapCalls[useGoogleMapCalls.length - 1]!;
    expect(opts.clickableIcons).toBe(true);
    expect(opts.onPoiClick).toBe(onPoiClick);
  });

  it('onMapClick prop forwarded verbatim', () => {
    const onMapClick = vi.fn();
    render(<TpMap pins={PINS} mode="overview" onMapClick={onMapClick} />);
    const opts = useGoogleMapCalls[useGoogleMapCalls.length - 1]!;
    expect(opts.onMapClick).toBe(onMapClick);
  });
});
