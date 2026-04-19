/**
 * useLeafletMap — Strict Mode idempotency test
 *
 * React 19 Strict Mode double-invokes effects. Leaflet throws
 * "Map container is already initialized" if we call L.map() twice on the
 * same DOM node. The hook guards this via container._leaflet_id check.
 * This test pins that behavior.
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
