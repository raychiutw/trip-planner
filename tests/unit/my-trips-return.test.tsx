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
