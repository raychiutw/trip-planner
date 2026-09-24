import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import GlobalMapPage from '../../src/pages/GlobalMapPage';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';
import { NewTripProvider } from '../../src/contexts/NewTripContext';
import { __clearMyTripsCache } from '../../src/hooks/useMyTrips';
import { LS_KEY_TRIP_PREF, lsGet, lsRemove, lsSet } from '../../src/lib/localStorage';

const user = { id: 'map-user', email: 'map@example.com', emailVerified: true, displayName: 'Map', avatarUrl: null, createdAt: '' };
const trips = [{ tripId: 'first', name: '第一趟' }, { tripId: 'private', name: '私人行程', title: '私人標題' }];
let paths: string[];
let listResponse: () => Promise<Response>;

function TripMapDestination() {
  const location = useLocation();
  return <div data-testid="map-destination">{location.pathname}</div>;
}

function openMap() {
  return render(<MemoryRouter initialEntries={['/map']}><ActiveTripProvider><NewTripProvider><Routes>
    <Route path="/map" element={<GlobalMapPage />} />
    <Route path="/trip/:tripId/map" element={<TripMapDestination />} />
  </Routes></NewTripProvider></ActiveTripProvider></MemoryRouter>);
}

beforeEach(() => {
  vi.restoreAllMocks();
  __clearMyTripsCache();
  lsRemove(LS_KEY_TRIP_PREF);
  paths = [];
  listResponse = async () => new Response(JSON.stringify(trips));
  vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const path = String(input);
    paths.push(path);
    if (path.includes('/oauth/userinfo')) return new Response(JSON.stringify(user));
    if (path.includes('/my-trips')) return listResponse();
    return new Response('{}');
  });
});

describe('root map selection', () => {
  it('chooses a private accessible trip and never starts the obsolete days read', async () => {
    lsSet(LS_KEY_TRIP_PREF, 'private');
    openMap();
    expect(await screen.findByTestId('map-destination')).toHaveTextContent('/trip/private/map');
    expect(paths.filter((path) => path.includes('/my-trips'))).toHaveLength(1);
    expect(paths.some((path) => path.includes('/days?all=1'))).toBe(false);
  });

  it('keeps a preference while the list is pending or fails', async () => {
    lsSet(LS_KEY_TRIP_PREF, 'private');
    let finish: ((value: Response) => void) | undefined;
    listResponse = () => new Promise((resolve) => { finish = resolve; });
    openMap();
    await waitFor(() => expect(finish).toBeDefined());
    expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('private');
    expect(screen.queryByTestId('global-map-empty')).toBeNull();
    await act(async () => finish!(new Response('{}', { status: 503 })));
    expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('private');
    expect(screen.queryByTestId('global-map-empty')).toBeNull();
  });

  it('shows the existing empty state only for a confirmed empty list', async () => {
    listResponse = async () => new Response('[]');
    openMap();
    expect(await screen.findByTestId('global-map-empty')).toBeTruthy();
    expect(screen.getByTestId('global-map-new-trip')).toBeTruthy();
    expect(screen.getByTestId('app-shell').getAttribute('data-layout')).toBe('2pane');
    expect(paths.some((path) => path.includes('/days?all=1'))).toBe(false);
  });

  it('falls back from a confirmed invalid preference to the first accessible trip', async () => {
    lsSet(LS_KEY_TRIP_PREF, 'removed');
    openMap();
    expect(await screen.findByTestId('map-destination')).toHaveTextContent('/trip/first/map');
    expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('first');
  });

  it('shows an error instead of an empty state after a failed first read', async () => {
    listResponse = async () => new Response('{}', { status: 503 });
    openMap();
    expect(await screen.findByRole('alert')).toHaveTextContent('載入行程失敗');
    expect(screen.queryByTestId('global-map-empty')).toBeNull();
  });

  it('does not let an older list refresh undo a newer selection', async () => {
    let finish: ((value: Response) => void) | undefined;
    listResponse = () => new Promise((resolve) => { finish = resolve; });
    openMap();
    await waitFor(() => expect(finish).toBeDefined());
    lsSet(LS_KEY_TRIP_PREF, 'private');
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'tp-trip-pref', newValue: localStorage.getItem('tp-trip-pref') })));
    await act(async () => finish!(new Response(JSON.stringify([trips[0]]))));
    expect(await screen.findByTestId('map-destination')).toHaveTextContent('/trip/private/map');
    expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('private');
  });
});
