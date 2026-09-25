import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TripLayout from '../../src/pages/TripLayout';
import MapPage from '../../src/pages/MapPage';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';
import { __clearMyTripsCache } from '../../src/hooks/useMyTrips';

vi.mock('@googlemaps/js-api-loader', () => ({
  setOptions: vi.fn(),
  importLibrary: vi.fn(async () => { if (sdkFailure) throw new Error('offline'); return { Map: FakeMap }; }),
}));
let sdkFailure = false;
let readFailure = false;
let noCoordinates = false;
const maps: FakeMap[] = [];
const markers: FakeMarker[] = [];
class FakeMap {
  listeners = new Map<string, (event: unknown) => void>();
  panTo = vi.fn(); setCenter = vi.fn(); setZoom = vi.fn(); getZoom = () => 13;
  fitBounds = vi.fn(); setMapTypeId = vi.fn();
  constructor() { maps.push(this); }
  addListener(name: string, fn: (event: unknown) => void) { this.listeners.set(name, fn); return { remove: () => this.listeners.delete(name) }; }
}
class FakeMarker {
  map: unknown; title: string; content: Node; zIndex = 0;
  click?: () => void;
  constructor(options: { map: unknown; title: string; content: Node }) {
    this.map = options.map; this.title = options.title; this.content = options.content; markers.push(this);
  }
  addListener(_: string, fn: () => void) { this.click = fn; return { remove: () => { this.click = undefined; } }; }
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function day(n: number) {
  return { id: n, dayNum: n, date: `2026-09-2${n}`, timeline: [1, 2].map(i => ({
    id: n * 10 + i, dayId: n, sortOrder: i, startTime: '09:00',
    stopPois: [{ poiId: n * 10 + i, sortOrder: 1, name: `第${n}天景點${i}`, type: 'attraction', lat: noCoordinates ? null : 25 + n + i / 10, lng: 127 }],
  })) };
}
beforeEach(() => {
  localStorage.clear(); __clearMyTripsCache(); maps.length = 0; markers.length = 0;
  sdkFailure = false; readFailure = false; noCoordinates = false;
  vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key');
  Element.prototype.scrollIntoView = vi.fn(); window.scrollTo = vi.fn();
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('google', { maps: { Map: FakeMap, marker: { AdvancedMarkerElement: FakeMarker },
    LatLngBounds: class { extend() {} }, ControlPosition: { RIGHT_CENTER: 8 }, event: { trigger: vi.fn() },
  } });
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    const path = new URL(String(input), 'https://test').pathname;
    if (path === '/api/oauth/userinfo') return response({ id: 'reader', email: 'reader@example.com' });
    if (path === '/api/my-trips') return response([{ tripId: 't1', name: '唯讀行程' }]);
    if (path === '/api/trips/t1') return response({ id: 't1', name: '唯讀行程', published: 1 });
    if (path === '/api/trips/t1/days') return readFailure ? response({}, 503) : response([day(1), day(2)]);
    if (path === '/api/places/resolve') return response({ name: 'Google 地點' });
    return response([]);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
function openMap(url = '/trip/t1/map?day=all') {
  render(<MemoryRouter initialEntries={[url]}><ActiveTripProvider><Routes>
    <Route path="/trip/:tripId" element={<TripLayout />}>
      <Route path="map" element={<MapPage />} />
      <Route path="stop/:entryId/map" element={<MapPage />} />
    </Route>
  </Routes></ActiveTripProvider></MemoryRouter>);
}
function card(id: number) { return document.querySelector(`[data-card-entry-id="${id}"]`)!; }

it('selects a non-first pin from overview and keeps pin, card and day aligned', async () => {
  openMap();
  await waitFor(() => expect(markers.some(m => m.title.includes('第2天景點2') && m.click)).toBe(true));
  act(() => markers.find(m => m.map && m.title.includes('第2天景點2'))!.click!());
  await waitFor(() => expect(card(22)).toHaveAttribute('aria-current', 'true'));
  expect(screen.getByTestId('map-day-2')).toHaveAttribute('aria-current', 'true');
  expect(maps[0]!.panTo).toHaveBeenLastCalledWith({ lat: 27.2, lng: 127 });
  fireEvent.click(card(21));
  expect(card(21)).toHaveAttribute('aria-current', 'true');
  expect(maps[0]!.panTo).toHaveBeenLastCalledWith({ lat: 27.1, lng: 127 });
  fireEvent.click(screen.getByTestId('map-day-overview'));
  expect(document.querySelector('[data-card-entry-id][aria-current="true"]')).toBeNull();
});

it('clears a Google place card when the user changes day', async () => {
  openMap();
  await waitFor(() => expect(maps[0]?.listeners.has('click')).toBe(true));
  act(() => maps[0]!.listeners.get('click')!({ placeId: 'google-place', latLng: { lat: () => 25, lng: () => 127 }, stop: vi.fn() }));
  expect(await screen.findByTestId('google-poi-card')).toBeVisible();
  fireEvent.click(screen.getByTestId('map-day-2'));
  expect(screen.queryByTestId('google-poi-card')).toBeNull();
  expect(card(21)).toHaveAttribute('aria-current', 'true');
});

it('keeps an explicit entry selectable after choosing a different card on the same day', async () => {
  openMap('/trip/t1/stop/12/map');
  await waitFor(() => expect(card(12)).toHaveAttribute('aria-current', 'true'));
  fireEvent.click(card(11));
  expect(card(11)).toHaveAttribute('aria-current', 'true');
});

it.each(['read', 'sdk', 'coordinates'])('offers the selected trip list after %s failure without claiming the trip is empty', async kind => {
  readFailure = kind === 'read'; sdkFailure = kind === 'sdk'; noCoordinates = kind === 'coordinates';
  openMap();
  const expected = kind === 'read' ? /行程資料載入失敗/ : kind === 'sdk' ? /地圖暫停服務/ : /景點尚無可用座標/;
  expect(await screen.findByText(expected)).toBeVisible();
  if (kind === 'read') expect(screen.getByRole('alert')).toHaveTextContent('行程資料載入失敗');
  expect(screen.getByRole('link', { name: '查看行程列表' })).toHaveAttribute('href', '/trip/t1');
  expect(screen.queryByText('這趟行程尚無景點')).toBeNull();
});
