import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { __clearMyTripsCache, useMyTrips } from '../../src/hooks/useMyTrips';
import { EVENT } from '../../src/lib/events';

const read = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/apiClient', () => ({ apiFetch: read }));

beforeEach(() => { __clearMyTripsCache(); read.mockReset(); });

it('returning from a page without list consumers refreshes changes missed while unsubscribed', async () => {
  read.mockResolvedValue([{ tripId: 'old', name: 'Existing trip' }]);
  const first = renderHook(() => useMyTrips('owner'));
  await waitFor(() => expect(first.result.current.status).toBe('success'));
  first.unmount();
  read.mockResolvedValue([{ tripId: 'old', name: 'Existing trip' }, { tripId: 'new', name: 'Accepted or cloned trip' }]);
  // The share/invitation page may have no subscribers when the write completes.
  act(() => window.dispatchEvent(new Event(EVENT.tripCreated)));
  const returned = renderHook(() => [useMyTrips('owner'), useMyTrips('owner')]);
  await waitFor(() => expect(returned.result.current[0].trips?.map(trip => trip.tripId)).toEqual(['old', 'new']));
  expect(returned.result.current[1].trips).toEqual(returned.result.current[0].trips);
  expect(read).toHaveBeenCalledTimes(2);
});

it('returning supersedes an older read that was still pending when all consumers left', async () => {
  let finishOld!: (value: unknown) => void;
  read.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
  const first = renderHook(() => useMyTrips('owner'));
  first.unmount();
  read.mockResolvedValue([{ tripId: 'new', name: 'Newly accessible trip' }]);
  const returned = renderHook(() => useMyTrips('owner'));
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(returned.result.current.trips?.[0].tripId).toBe('new'));
  await act(async () => finishOld([{ tripId: 'old', name: 'Old snapshot' }]));
  expect(returned.result.current.trips?.[0].tripId).toBe('new');
});

it('does not revalidate an old account before the returning consumer is authenticated', async () => {
  read.mockResolvedValue([{ tripId: 'private', name: 'Previous account' }]);
  const first = renderHook(() => useMyTrips('owner'));
  await waitFor(() => expect(first.result.current.status).toBe('success'));
  first.unmount();
  const returned = renderHook(() => useMyTrips(undefined));
  expect(returned.result.current.trips).toBeUndefined();
  expect(read).toHaveBeenCalledTimes(1);
});
