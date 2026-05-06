/**
 * Shared Google Maps JS API mock for unit tests.
 *
 * Sets up `globalThis.google.maps.*` constructors as Vitest spies so tests can:
 *   - Render components that use `google.maps.Marker` / `Map` / `Polyline` / etc.
 *   - Assert specific operations were called (e.g. `marker.setIcon`, `map.panTo`).
 *
 * Also stubs `@googlemaps/js-api-loader` so the loader resolves immediately
 * (no real network call).
 *
 * Use in beforeEach() to reset spies between tests:
 *   import { setupGoogleMapsMock, getMockMap, getMockMarker } from './__mocks__/google-maps';
 *   beforeEach(setupGoogleMapsMock);
 */
import { vi } from 'vitest';

export interface MockMarker {
  setMap: ReturnType<typeof vi.fn>;
  setIcon: ReturnType<typeof vi.fn>;
  setLabel: ReturnType<typeof vi.fn>;
  setZIndex: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  getPosition: ReturnType<typeof vi.fn>;
  /** Initial constructor options captured. */
  _opts: unknown;
}

export interface MockPolyline {
  setMap: ReturnType<typeof vi.fn>;
  setOptions: ReturnType<typeof vi.fn>;
  setPath: ReturnType<typeof vi.fn>;
  _opts: unknown;
}

export interface MockMap {
  setCenter: ReturnType<typeof vi.fn>;
  setZoom: ReturnType<typeof vi.fn>;
  getZoom: ReturnType<typeof vi.fn>;
  panTo: ReturnType<typeof vi.fn>;
  fitBounds: ReturnType<typeof vi.fn>;
  setMapTypeId: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  _opts: unknown;
}

export interface MockBounds {
  extend: ReturnType<typeof vi.fn>;
  getCenter: ReturnType<typeof vi.fn>;
}

const _markers: MockMarker[] = [];
const _polylines: MockPolyline[] = [];
const _maps: MockMap[] = [];

function createMarker(opts: unknown): MockMarker {
  const m: MockMarker = {
    setMap: vi.fn(),
    setIcon: vi.fn(),
    setLabel: vi.fn(),
    setZIndex: vi.fn(),
    setPosition: vi.fn(),
    addListener: vi.fn(() => ({ remove: vi.fn() })),
    getPosition: vi.fn(() => ({ lat: () => 0, lng: () => 0 })),
    _opts: opts,
  };
  _markers.push(m);
  return m;
}

function createPolyline(opts: unknown): MockPolyline {
  const p: MockPolyline = {
    setMap: vi.fn(),
    setOptions: vi.fn(),
    setPath: vi.fn(),
    _opts: opts,
  };
  _polylines.push(p);
  return p;
}

function createMap(_el: unknown, opts: unknown): MockMap {
  const m: MockMap = {
    setCenter: vi.fn(),
    setZoom: vi.fn(),
    getZoom: vi.fn(() => 11),
    panTo: vi.fn(),
    fitBounds: vi.fn(),
    setMapTypeId: vi.fn(),
    addListener: vi.fn(() => ({ remove: vi.fn() })),
    _opts: opts,
  };
  _maps.push(m);
  return m;
}

function createBounds(): MockBounds {
  return {
    extend: vi.fn(),
    getCenter: vi.fn(() => ({ lat: () => 0, lng: () => 0 })),
  };
}

/**
 * Install google.maps mock + reset all captured instances.
 * Call from beforeEach() to ensure clean state per test.
 */
export function setupGoogleMapsMock(): void {
  _markers.length = 0;
  _polylines.length = 0;
  _maps.length = 0;

  const googleMock = {
    maps: {
      Map: vi.fn().mockImplementation(createMap),
      Marker: vi.fn().mockImplementation(createMarker),
      Polyline: vi.fn().mockImplementation(createPolyline),
      LatLng: vi.fn().mockImplementation((lat: number, lng: number) => ({
        lat: () => lat,
        lng: () => lng,
      })),
      LatLngBounds: vi.fn().mockImplementation(createBounds),
      SymbolPath: { CIRCLE: 0 },
      ControlPosition: {
        TOP_LEFT: 1,
        TOP_RIGHT: 3,
        BOTTOM_LEFT: 9,
        BOTTOM_RIGHT: 11,
      },
      MapTypeId: {
        ROADMAP: 'roadmap',
        SATELLITE: 'satellite',
        HYBRID: 'hybrid',
      },
      event: {
        trigger: vi.fn(),
      },
    },
  };

  (globalThis as unknown as { google: unknown }).google = googleMock;
}

/** Get all mock markers created since last setupGoogleMapsMock() call. */
export function getMockMarkers(): MockMarker[] {
  return [..._markers];
}

/** Get all mock polylines created since last setupGoogleMapsMock() call. */
export function getMockPolylines(): MockPolyline[] {
  return [..._polylines];
}

/** Get the most-recently-created mock map (typical case: single map per test). */
export function getMockMap(): MockMap | undefined {
  return _maps[_maps.length - 1];
}

/**
 * Mock the `@googlemaps/js-api-loader` package so loader resolves immediately
 * without network. Call BEFORE the module under test imports the loader.
 *
 * Use vi.mock() at the top of test file:
 *   vi.mock('@googlemaps/js-api-loader', () => mockJsApiLoader);
 */
export const mockJsApiLoader = {
  setOptions: vi.fn(),
  importLibrary: vi.fn(async (lib: string) => {
    if (lib === 'maps') {
      return {
        Map: (globalThis as unknown as { google: { maps: { Map: unknown } } }).google.maps.Map,
      };
    }
    return {};
  }),
};
