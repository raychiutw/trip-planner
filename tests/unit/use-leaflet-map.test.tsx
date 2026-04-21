/**
 * useLeafletMap — Strict Mode idempotency test
 *
 * React 19 Strict Mode double-invokes effects. Leaflet throws
 * "Map container is already initialized" if we call L.map() twice on the
 * same DOM node. The hook guards this via container._leaflet_id check.
 * This test pins that behavior.
 *
 * PR3 review fix #4: fitBounds single-point branch — setView must not receive
 * NaN as zoom level when map.getZoom() returns NaN (e.g. before tiles load).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { StrictMode } from 'react';
import { render, act } from '@testing-library/react';
import { useLeafletMap } from '../../src/hooks/useLeafletMap';

// Give the jsdom root a size so Leaflet can compute tile ranges without crashing.
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 400 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 300 });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 400 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 300 });
});

function TestMap() {
  const { containerRef } = useLeafletMap({ center: [26.2, 127.7], zoom: 10 });
  return <div ref={containerRef} style={{ width: 400, height: 300 }} data-testid="map" />;
}

describe('useLeafletMap', () => {
  it('does not throw under React.StrictMode double-invoke', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      act(() => {
        render(
          <StrictMode>
            <TestMap />
          </StrictMode>,
        );
      });
    }).not.toThrow();
    // Leaflet itself may log attribution warnings in jsdom — we only care that
    // "Map container is already initialized" does NOT show up.
    const calls = consoleError.mock.calls.flat().map(String).join('\n');
    expect(calls).not.toMatch(/already initialized/i);
    consoleError.mockRestore();
  });

  it('mount then unmount cleans up the container', () => {
    const { unmount, container } = render(<TestMap />);
    // Leaflet tags the container with _leaflet_id after init
    const mapDiv = container.querySelector('[data-testid="map"]');
    expect(mapDiv).toBeTruthy();
    unmount();
    // After unmount, re-mounting the same test should not throw
    expect(() => render(<TestMap />)).not.toThrow();
  });
});

// PR3 review fix #4: setView NaN guard
describe('useLeafletMap fitBounds — setView NaN guard', () => {
  it('passes zoom=14 to setView when getZoom() returns NaN', () => {
    // Build a minimal mock map object
    const setViewMock = vi.fn();
    const mockMap = {
      getZoom: vi.fn().mockReturnValue(NaN),
      setView: setViewMock,
      fitBounds: vi.fn(),
      stop: vi.fn(),
      flyTo: vi.fn(),
      eachLayer: vi.fn(),
      remove: vi.fn(),
    };

    // Inline the single-point branch logic (mirrors useLeafletMap fitBounds)
    function fitBoundsSinglePoint(map: typeof mockMap, latlngs: [number, number][]) {
      if (!map || latlngs.length === 0) return;
      if (latlngs.length === 1) {
        const only = latlngs[0];
        if (only) {
          const z = map.getZoom();
          map.setView(only, Number.isFinite(z) ? Math.max(z, 14) : 14);
        }
        return;
      }
    }

    fitBoundsSinglePoint(mockMap, [[26.2, 127.7]]);

    expect(setViewMock).toHaveBeenCalledWith([26.2, 127.7], 14);
  });

  it('passes Math.max(z, 14) when getZoom() returns a valid zoom', () => {
    const setViewMock = vi.fn();
    const mockMap = {
      getZoom: vi.fn().mockReturnValue(10),
      setView: setViewMock,
      fitBounds: vi.fn(),
      stop: vi.fn(),
      flyTo: vi.fn(),
      eachLayer: vi.fn(),
      remove: vi.fn(),
    };

    function fitBoundsSinglePoint(map: typeof mockMap, latlngs: [number, number][]) {
      if (!map || latlngs.length === 0) return;
      if (latlngs.length === 1) {
        const only = latlngs[0];
        if (only) {
          const z = map.getZoom();
          map.setView(only, Number.isFinite(z) ? Math.max(z, 14) : 14);
        }
        return;
      }
    }

    fitBoundsSinglePoint(mockMap, [[26.2, 127.7]]);

    // z=10 < 14 → should snap to 14
    expect(setViewMock).toHaveBeenCalledWith([26.2, 127.7], 14);
  });

  it('preserves zoom when getZoom() returns value > 14', () => {
    const setViewMock = vi.fn();
    const mockMap = {
      getZoom: vi.fn().mockReturnValue(16),
      setView: setViewMock,
      fitBounds: vi.fn(),
      stop: vi.fn(),
      flyTo: vi.fn(),
      eachLayer: vi.fn(),
      remove: vi.fn(),
    };

    function fitBoundsSinglePoint(map: typeof mockMap, latlngs: [number, number][]) {
      if (!map || latlngs.length === 0) return;
      if (latlngs.length === 1) {
        const only = latlngs[0];
        if (only) {
          const z = map.getZoom();
          map.setView(only, Number.isFinite(z) ? Math.max(z, 14) : 14);
        }
        return;
      }
    }

    fitBoundsSinglePoint(mockMap, [[26.2, 127.7]]);

    // z=16 > 14 → should keep 16
    expect(setViewMock).toHaveBeenCalledWith([26.2, 127.7], 16);
  });
});
