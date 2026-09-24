import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import MapPage from '../../src/pages/MapPage';
import { TripContext } from '../../src/contexts/TripContext';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';
import { __clearMyTripsCache } from '../../src/hooks/useMyTrips';
import { LS_KEY_TRIP_PREF, lsGet, lsRemove, lsSet } from '../../src/lib/localStorage';
import { EVENT } from '../../src/lib/events';
import type { UseTripReturn } from '../../src/hooks/useTrip';

vi.mock('../../src/components/trip/TpMap', () => ({ default: () => null }));

const user = { id: 'map-user', email: 'map@example.com', emailVerified: true, displayName: 'Map', avatarUrl: null, createdAt: '' };
const trips = [{ tripId: 'first', name: '第一趟' }, { tripId: 'private', name: '私人行程', title: '私人標題' }];
let listResponse: () => Promise<Response>;

function TripMapRoute() {
  const { tripId } = useParams();
  const trip = { id: tripId, name: tripId === 'private' ? '私人內容' : '第一趟內容' };
  const context = { trip, allDays: {}, loading: false, days: [], currentDay: undefined, currentDayNum: 1,
    switchDay: () => {}, refetchCurrentDay: () => {}, docs: [], error: null } as unknown as UseTripReturn;
  return <TripContext.Provider value={context}><MapPage /></TripContext.Provider>;
}

function openMap(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><ActiveTripProvider><Routes>
    <Route path="/trip/:tripId/map" element={<TripMapRoute />} />
  </Routes></ActiveTripProvider></MemoryRouter>);
}

beforeEach(() => {
  vi.restoreAllMocks();
  __clearMyTripsCache();
  lsRemove(LS_KEY_TRIP_PREF);
  listResponse = async () => new Response(JSON.stringify(trips));
  vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const path = String(input);
    if (path.includes('/oauth/userinfo')) return new Response(JSON.stringify(user));
    if (path.includes('/my-trips')) return listResponse();
    return new Response('{}');
  });
});

describe('trip map selection', () => {
  it('shows private metadata and keeps an explicit target absent from the accessible list', async () => {
    lsSet(LS_KEY_TRIP_PREF, 'first');
    listResponse = async () => new Response(JSON.stringify(trips.filter((trip) => trip.tripId !== 'private')));
    openMap('/trip/private/map');
    expect(await screen.findByText('私人內容')).toBeTruthy();
    expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('private');
  });

  it('switches URL, trip content and preference to the private trip', async () => {
    openMap('/trip/first/map');
    fireEvent.click(await screen.findByTestId('map-trip-title'));
    fireEvent.click(await screen.findByTestId('map-trip-pick-private'));
    expect(await screen.findByText('私人內容')).toBeTruthy();
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('private'));
  });

  it('does not lose a newer choice when an old list refresh returns late', async () => {
    openMap('/trip/first/map');
    fireEvent.click(await screen.findByTestId('map-trip-title'));
    let finish: ((response: Response) => void) | undefined;
    listResponse = () => new Promise((resolve) => { finish = resolve; });
    act(() => window.dispatchEvent(new Event(EVENT.tripUpdated)));
    await waitFor(() => expect(finish).toBeDefined());
    fireEvent.click(screen.getByTestId('map-trip-pick-private'));
    await act(async () => finish!(new Response(JSON.stringify([trips[0]]))));
    expect(await screen.findByText('私人內容')).toBeTruthy();
    expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('private');
  });

  it('offers a newly accessible private trip after the normal update event', async () => {
    listResponse = async () => new Response(JSON.stringify([trips[0]]));
    openMap('/trip/first/map');
    await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('first'));
    listResponse = async () => new Response(JSON.stringify(trips));
    act(() => window.dispatchEvent(new Event(EVENT.tripUpdated)));
    fireEvent.click(await screen.findByTestId('map-trip-title'));
    expect(await screen.findByTestId('map-trip-pick-private')).toHaveTextContent('私人標題');
  });
});
