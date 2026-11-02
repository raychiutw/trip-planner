import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../src/contexts/TripContext', async (load) => ({
  ...(await load<typeof import('../../src/contexts/TripContext')>()),
  useTripContext: () => ({
    trip: { id: 'trip-one', title: '行程' },
    allDays: { 1: {
      id: 1, dayNum: 1, hotel: null,
      timeline: [{ id: 7, sortOrder: 1, stopPois: [{ poiId: 9, sortOrder: 1, name: '無座標景點', type: 'attraction', lat: null, lng: null }] }],
    } },
    loading: false, error: null,
  }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'owner', email: 'owner@example.test', displayName: 'Owner' } }) }));

it('shows a location-specific empty state when a trip has a stop without coordinates', async () => {
  const { default: MapPage } = await import('../../src/pages/MapPage');
  render(<MemoryRouter initialEntries={['/trip/trip-one/map']}><Routes>
    <Route path="/trip/:tripId/map" element={<MapPage />} />
  </Routes></MemoryRouter>);

  expect((await screen.findAllByText('景點尚未設定位置')).length).toBeGreaterThan(0);
  expect(screen.queryByText('這趟行程尚無景點')).not.toBeInTheDocument();
});
