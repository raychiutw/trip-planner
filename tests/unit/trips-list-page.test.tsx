/**
 * TripsListPage unit test — V2 design audit landing
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '' },
    reload: () => {},
  }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '' },
    reload: () => {},
  }),
}));

import TripsListPage from '../../src/pages/TripsListPage';

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockBoth(my: { tripId: string }[], all: Array<Record<string, unknown>>) {
  return vi.fn().mockImplementation((url: string) => {
    if (url === '/api/my-trips') {
      return Promise.resolve(new Response(JSON.stringify(my), { status: 200 }));
    }
    if (url.startsWith('/api/trips')) {
      return Promise.resolve(new Response(JSON.stringify(all), { status: 200 }));
    }
    return Promise.resolve(new Response('null', { status: 200 }));
  });
}

describe('TripsListPage', () => {
  it('shows loading state initially', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<MemoryRouter><TripsListPage /></MemoryRouter>);
    expect(screen.getByTestId('trips-list-loading')).toBeTruthy();
  });

  it('renders empty state when user has no trips', async () => {
    vi.stubGlobal('fetch', mockBoth([], []));
    render(<MemoryRouter><TripsListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-empty')).toBeTruthy());
    expect(screen.getByText(/沒有可編輯的行程/)).toBeTruthy();
  });

  it('renders cards for accessible trips with country eyebrow + title', async () => {
    const my = [{ tripId: 'okinawa-trip' }, { tripId: 'seoul-trip' }];
    const all = [
      { tripId: 'okinawa-trip', name: '沖繩之旅', title: '沖繩之旅', countries: 'JP', published: 1 },
      { tripId: 'seoul-trip', name: '首爾美食行', title: '首爾美食行', countries: 'KR', published: 1 },
      { tripId: 'unrelated', name: 'Other', countries: 'TW', published: 1 },
    ];
    vi.stubGlobal('fetch', mockBoth(my, all));
    render(<MemoryRouter><TripsListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-okinawa-trip')).toBeTruthy());
    expect(screen.getByText('沖繩之旅')).toBeTruthy();
    expect(screen.getByText('首爾美食行')).toBeTruthy();
    expect(screen.getByText('JAPAN')).toBeTruthy();
    expect(screen.getByText('KOREA')).toBeTruthy();
    // Unrelated trip should NOT render — user has no permission
    expect(screen.queryByText('Other')).toBeNull();
  });

  it('falls back to tripId when trip metadata missing', async () => {
    const my = [{ tripId: 'orphan-trip' }];
    vi.stubGlobal('fetch', mockBoth(my, []));
    render(<MemoryRouter><TripsListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-orphan-trip')).toBeTruthy());
    // name falls back to tripId, eyebrow defaults to "TRIP"
    expect(screen.getAllByText('orphan-trip').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('TRIP')).toBeTruthy();
  });

  it('shows error banner on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    render(<MemoryRouter><TripsListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-error')).toBeTruthy());
  });

  it('shows error banner on /api/my-trips 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url === '/api/my-trips') return Promise.resolve(new Response('boom', { status: 500 }));
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    }));
    render(<MemoryRouter><TripsListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-error')).toBeTruthy());
  });
});
