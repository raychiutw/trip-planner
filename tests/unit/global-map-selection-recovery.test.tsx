import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import GlobalMapPage from '../../src/pages/GlobalMapPage';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';
import { NewTripProvider } from '../../src/contexts/NewTripContext';
import { __clearMyTripsCache } from '../../src/hooks/useMyTrips';
import { LS_KEY_TRIP_PREF, lsGet, lsSet } from '../../src/lib/localStorage';

vi.mock('../../src/hooks/useRequireAuth', () => ({ useRequireAuth: () => undefined }));
vi.mock('../../src/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'owner' } }) }));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

beforeEach(() => { localStorage.clear(); __clearMyTripsCache(); });
afterEach(() => { vi.unstubAllGlobals(); });

function mount() {
  function Destination() { const { tripId } = useParams(); return <p data-testid="map-destination">{tripId}</p>; }
  return render(<MemoryRouter initialEntries={['/map']}><ActiveTripProvider><NewTripProvider><Routes>
    <Route path="/map" element={<GlobalMapPage />} />
    <Route path="/trip/:tripId/map" element={<Destination />} />
  </Routes></NewTripProvider></ActiveTripProvider></MemoryRouter>);
}

it('root map corrects a stale preferred trip before navigating', async () => {
  lsSet(LS_KEY_TRIP_PREF, 'removed-trip');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ tripId: 'accessible-trip', name: '可讀行程' }]), { status: 200 })));
  mount();

  await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('accessible-trip'));
  expect(screen.getByTestId('map-destination')).toHaveTextContent('accessible-trip');
});

it('root map opens the saved trip when it is still accessible', async () => {
  lsSet(LS_KEY_TRIP_PREF, 'second-trip');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
    { tripId: 'first-trip', name: '第一趟' }, { tripId: 'second-trip', name: '第二趟' },
  ]), { status: 200 })));
  mount();

  expect(await screen.findByTestId('map-destination')).toHaveTextContent('second-trip');
  expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('second-trip');
});

it('failed trip-list read keeps a saved preference and opens that trip', async () => {
  lsSet(LS_KEY_TRIP_PREF, 'preferred-trip');
  vi.stubGlobal('fetch', vi.fn(async () => new Response('unavailable', { status: 503 })));
  mount();

  expect(await screen.findByTestId('map-destination')).toHaveTextContent('preferred-trip');
  expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('preferred-trip');
});

it('failed trip-list read without a preference offers retry, not a false empty state', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('unavailable', { status: 503 })));
  mount();

  expect(await screen.findByRole('alert')).toHaveTextContent('無法載入行程清單');
  expect(screen.getByRole('button', { name: '重試' })).toBeInTheDocument();
  expect(screen.queryByTestId('global-map-empty')).not.toBeInTheDocument();
});

it('confirmed empty trip list clears a stale preference and offers to create a trip', async () => {
  lsSet(LS_KEY_TRIP_PREF, 'removed-trip');
  vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
  mount();

  expect(await screen.findByTestId('global-map-empty')).toBeInTheDocument();
  expect(screen.getByTestId('global-map-new-trip')).toBeInTheDocument();
  await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBeNull());
});
