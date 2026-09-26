import { expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../src/contexts/TripContext', async (load) => ({
  ...(await load<typeof import('../../src/contexts/TripContext')>()),
  useTripContext: () => ({
    trip: { id: 'trip-one', title: '沖繩行程' },
    allDays: { 1: { dayNum: 1, entries: [] }, 2: { dayNum: 2, entries: [] } },
    loading: false, error: null,
  }),
}));
vi.mock('../../src/hooks/useMapData', async (load) => {
  const actual = await load<typeof import('../../src/hooks/useMapData')>();
  const pin = { id: 1, type: 'entry' as const, index: 1, title: '那覇空港', lat: 26.2, lng: 127.6, sortOrder: 0 };
  return {
    ...actual,
    extractPinsFromDay: () => ({ pins: [pin], missingCount: 0 }),
    extractPinsFromAllDays: () => ({ pins: [pin], pinsByDay: new Map([[1, [pin]]]), missingCount: 0 }),
  };
});
vi.mock('../../src/hooks/useGoogleMap', () => ({ useGoogleMap: () => ({
  containerRef: { current: null }, map: null, loadError: new Error('map failed'),
  fitBounds: () => {}, flyTo: () => {},
}) }));
vi.mock('../../src/hooks/useRoute', () => ({ useRoute: () => null }));

class Observer { observe() {} disconnect() {} }
vi.stubGlobal('IntersectionObserver', Observer);
Element.prototype.scrollIntoView ??= () => {};

it('map failure keeps cards and dates, with a persistent retry and trip-list action', async () => {
  const { default: MapPage } = await import('../../src/pages/MapPage');
  render(<MemoryRouter initialEntries={['/trip/trip-one/map']}><Routes>
    <Route path="/trip/:tripId/map" element={<MapPage />} />
    <Route path="/trips" element={<p>行程清單已開啟</p>} />
  </Routes></MemoryRouter>);

  expect(await screen.findByRole('alert')).toHaveTextContent('地圖暫停服務');
  expect(screen.getByRole('button', { name: '重試' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '查看行程' })).toHaveAttribute('href', '/trips?selected=trip-one');
  expect(screen.getByText('那覇空港')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('map-day-2')).toBeInTheDocument());
});
