import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { pickFromTripSelect } from './__helpers__/tripSelect';
import { pickTime } from './__helpers__/tripTimePicker';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
  apiFetchRaw: async (path: string, init?: RequestInit) => {
    const data = await apiFetchMock(path, init);
    return new Response(JSON.stringify(data ?? {}), { status: 200 });
  },
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

import AddPoiFavoriteToTripPage from '../../src/pages/AddPoiFavoriteToTripPage';
import AddEntryPage from '../../src/pages/AddEntryPage';
import { ApiError } from '../../src/lib/errors';

const favorite = { id: 5, poiId: 100, poiName: '沖繩咖啡', poiAddress: '沖繩', poiType: 'restaurant', favoritedAt: '', note: null };
const trips = [{ tripId: 't1', name: 'T1' }, { tripId: 't2', name: 'T2' }];
const day1 = [{ dayNum: 1, date: '2026-09-26', label: '第一天' }];
const day2 = [{ dayNum: 2, date: '2026-09-27', label: '第二天' }];

function renderFavorite() {
  render(<MemoryRouter initialEntries={['/favorites/5/add-to-trip']}><Routes>
    <Route path="/favorites/:id/add-to-trip" element={<AddPoiFavoriteToTripPage />} />
  </Routes></MemoryRouter>);
}

function renderEntry(path: string) {
  function Destination() {
    const location = useLocation();
    return <div data-testid="picker-destination">{location.search}</div>;
  }
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/trip/:tripId/add-entry" element={<AddEntryPage />} />
    <Route path="/trip/:tripId/stop/:entryId/change-poi" element={<Destination />} />
  </Routes></MemoryRouter>);
}

beforeEach(() => {
  apiFetchMock.mockReset();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === '/api/oauth/userinfo') {
      return new Response(JSON.stringify({ id: 'u1', email: 'test@example.com', emailVerified: true, displayName: 'Test', avatarUrl: null, createdAt: '' }), { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${String(input)}`);
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('add-to-trip target day', () => {
  it('favorite: failed day load offers retry without losing POI or time; submits a loaded day', async () => {
    let attempts = 0;
    apiFetchMock.mockImplementation((path) => {
      if (path === '/poi-favorites') return Promise.resolve([favorite]);
      if (path === '/my-trips') return Promise.resolve(trips);
      if (path === '/trips/t1/days') return ++attempts === 1 ? Promise.reject(new Error('server error')) : Promise.resolve(day1);
      return Promise.resolve({});
    });
    renderFavorite();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy());
    await pickFromTripSelect('favorites-add-to-trip-trip', /T1/);
    pickTime('favorites-add-to-trip-start', '12:00');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('載入失敗'));
    expect(screen.queryByText('該行程沒有天數')).toBeNull();
    expect((screen.getByTestId('favorites-add-to-trip-submit') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '重試' }));
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-day')).toBeTruthy());
    expect(screen.getByText('沖繩咖啡')).toBeTruthy();
    fireEvent.click(screen.getByTestId('favorites-add-to-trip-submit'));
    await waitFor(() => {
      const call = apiFetchMock.mock.calls.find(([path]) => path === '/poi-favorites/5/add-to-trip');
      expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ tripId: 't1', dayNum: 1, startTime: '12:00' });
    });
  });

  it('favorite: switching trips rejects a late old day response and submits only the new trip day', async () => {
    let resolveOld!: (days: typeof day1) => void;
    const oldDays = new Promise<typeof day1>((resolve) => { resolveOld = resolve; });
    apiFetchMock.mockImplementation((path) => {
      if (path === '/poi-favorites') return Promise.resolve([favorite]);
      if (path === '/my-trips') return Promise.resolve(trips);
      if (path === '/trips/t1/days') return oldDays;
      if (path === '/trips/t2/days') return Promise.resolve(day2);
      return Promise.resolve({});
    });
    renderFavorite();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy());
    await pickFromTripSelect('favorites-add-to-trip-trip', /T1/);
    await pickFromTripSelect('favorites-add-to-trip-trip', /T2/);
    await waitFor(() => expect(screen.getByText(/Day 2/)).toBeTruthy());
    resolveOld(day1);
    await waitFor(() => expect(screen.queryByText(/Day 1/)).toBeNull());
    fireEvent.click(screen.getByTestId('favorites-add-to-trip-submit'));
    await waitFor(() => {
      const call = apiFetchMock.mock.calls.find(([path]) => path === '/poi-favorites/5/add-to-trip');
      expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ tripId: 't2', dayNum: 2 });
    });
  });

  it('entry: failed day load retries, and invalid deep link falls back to a real day', async () => {
    let attempts = 0;
    apiFetchMock.mockImplementation((path) => {
      if (path === '/trips/t1/days') return ++attempts === 1 ? Promise.reject(new Error('network')) : Promise.resolve(day2);
      if (path === '/trips/t1') return Promise.resolve({ id: 't1', title: '行程' });
      return Promise.resolve({});
    });
    renderEntry('/trip/t1/add-entry?day=99');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('載入失敗'));
    expect((screen.getByTestId('add-entry-pick-search') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '重試' }));
    await waitFor(() => expect(screen.getByTestId('add-entry-daypicker')).toBeTruthy());
    fireEvent.click(screen.getByTestId('add-entry-pick-search'));
    await waitFor(() => expect(screen.getByTestId('picker-destination')).toBeTruthy());
    expect(screen.getByTestId('picker-destination').textContent).toContain('day=2');
  });

  it.each([
    ['/trip/t1/add-entry', 'day=1'],
    ['/trip/t1/add-entry?day=2', 'day=2'],
  ])('entry: %s opens the picker with a valid day', async (path, expected) => {
    apiFetchMock.mockImplementation((requestPath) => {
      if (requestPath === '/trips/t1/days') return Promise.resolve([...day1, ...day2]);
      return Promise.resolve({ id: 't1' });
    });
    renderEntry(path);
    await waitFor(() => expect(screen.getByTestId('add-entry-daypicker')).toBeTruthy());
    fireEvent.click(screen.getByTestId('add-entry-pick-search'));
    await waitFor(() => expect(screen.getByTestId('picker-destination').textContent).toContain(expected));
  });

  it('a successful empty day list shows the empty state and blocks both entry points', async () => {
    apiFetchMock.mockImplementation((path) => {
      if (path === '/poi-favorites') return Promise.resolve([favorite]);
      if (path === '/my-trips') return Promise.resolve(trips);
      if (path.endsWith('/days')) return Promise.resolve([]);
      return Promise.resolve({ id: 't1' });
    });
    renderFavorite();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy());
    await pickFromTripSelect('favorites-add-to-trip-trip', /T1/);
    await waitFor(() => expect(screen.getByText('該行程沒有天數')).toBeTruthy());
    expect((screen.getByTestId('favorites-add-to-trip-submit') as HTMLButtonElement).disabled).toBe(true);
    renderEntry('/trip/t1/add-entry?day=1');
    await waitFor(() => expect(screen.getAllByText('該行程沒有天數').length).toBe(2));
    expect((screen.getByTestId('add-entry-pick-search') as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(['403', '404', '500', 'network'])('favorite: %s day failure remains retryable', async (failure) => {
    apiFetchMock.mockImplementation((path) => {
      if (path === '/poi-favorites') return Promise.resolve([favorite]);
      if (path === '/my-trips') return Promise.resolve(trips);
      if (path === '/trips/t1/days') return Promise.reject(
        failure === 'network' ? new Error('network') : new ApiError('SYS_INTERNAL', Number(failure), failure),
      );
      return Promise.resolve({});
    });
    renderFavorite();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy());
    await pickFromTripSelect('favorites-add-to-trip-trip', /T1/);
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-day-error')).toBeTruthy());
    expect(screen.queryByText('該行程沒有天數')).toBeNull();
    expect(screen.getByRole('button', { name: '重試' })).toBeTruthy();
  });

  it('favorite: an initial read failure can retry without losing the target POI', async () => {
    let attempts = 0;
    apiFetchMock.mockImplementation((path) => {
      if (path === '/poi-favorites') return ++attempts === 1 ? Promise.reject(new Error('offline')) : Promise.resolve([favorite]);
      if (path === '/my-trips') return Promise.resolve(trips);
      return Promise.resolve(day1);
    });
    renderFavorite();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-load-error')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: '重試' }));
    await waitFor(() => expect(screen.getByText('沖繩咖啡')).toBeTruthy());
    expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy();
  });
});
