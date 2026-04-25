/**
 * TripsListPage unit test — unified /trips?selected= architecture.
 *
 * Mobile + ?selected → embedded TripPage as main (cards hidden)
 * Desktop → cards in main + embedded TripPage in sheet (always)
 * No ?selected mobile → cards stacked
 *
 * TripPage is mocked because it has heavy dependencies (useTrip + useDarkMode +
 * leaflet etc) unrelated to TripsListPage's concern.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NewTripProvider } from '../../src/contexts/NewTripContext';

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
vi.mock('../../src/pages/TripPage', () => ({
  default: ({ tripId, noShell }: { tripId?: string; noShell?: boolean }) => (
    <div data-testid="embedded-trip-page" data-trip-id={tripId} data-no-shell={String(noShell)}>
      Mock TripPage: {tripId}
    </div>
  ),
}));

function mockMatchMedia(isDesktop: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (q: string) => ({
      matches: isDesktop && q.includes('1024'),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

import TripsListPage from '../../src/pages/TripsListPage';

beforeEach(() => mockMatchMedia(true));
afterEach(() => vi.unstubAllGlobals());

function mockApi(my: { tripId: string }[], all: Array<Record<string, unknown>>) {
  return vi.fn().mockImplementation((url: string) => {
    if (url === '/api/my-trips') return Promise.resolve(new Response(JSON.stringify(my), { status: 200 }));
    if (url.startsWith('/api/trips')) return Promise.resolve(new Response(JSON.stringify(all), { status: 200 }));
    return Promise.resolve(new Response('null', { status: 200 }));
  });
}

const SAMPLE = [
  { tripId: 'okinawa', name: '沖繩之旅', title: '沖繩之旅', countries: 'JP', published: 1, day_count: 5, start_date: '2026-07-26', end_date: '2026-07-30', member_count: 2 },
  { tripId: 'seoul', name: '首爾美食行', title: '首爾美食行', countries: 'KR', published: 1, day_count: 4, start_date: '2026-08-15', end_date: '2026-08-18', member_count: 1 },
];

describe('TripsListPage', () => {
  it('shows loading initially', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    expect(screen.getByTestId('trips-list-loading')).toBeTruthy();
  });

  it('zero trips → hero CTA in main', async () => {
    vi.stubGlobal('fetch', mockApi([], []));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-empty')).toBeTruthy());
    expect(screen.getByTestId('trips-list-new-trip-hero')).toBeTruthy();
  });

  it('cards render with country + day count + date range + member count', async () => {
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-okinawa')).toBeTruthy());
    expect(screen.getByText('JAPAN · 5 DAYS')).toBeTruthy();
    expect(screen.getByText('7/26 – 7/30 · 2 旅伴')).toBeTruthy();
    expect(screen.getByText('KOREA · 4 DAYS')).toBeTruthy();
  });

  it('trailing 新增行程 card present when trips exist and opens modal on click', async () => {
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-new-trip-card')).toBeTruthy());
    const btn = screen.getByTestId('trips-list-new-trip-card');
    expect(btn.tagName).toBe('BUTTON');
    expect(screen.queryByTestId('new-trip-modal')).toBeNull();
    fireEvent.click(btn);
    await waitFor(() => expect(screen.queryByTestId('new-trip-modal')).toBeTruthy());
  });

  it('empty hero CTA opens new-trip modal', async () => {
    vi.stubGlobal('fetch', mockApi([], []));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-new-trip-hero')).toBeTruthy());
    fireEvent.click(screen.getByTestId('trips-list-new-trip-hero'));
    await waitFor(() => expect(screen.queryByTestId('new-trip-modal')).toBeTruthy());
  });

  it('desktop: first trip auto-selected → embedded TripPage in sheet', async () => {
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryAllByTestId('embedded-trip-page').length).toBeGreaterThan(0));
    const sheet = screen.getAllByTestId('embedded-trip-page')[0];
    expect(sheet?.getAttribute('data-trip-id')).toBe('okinawa');
    expect(sheet?.getAttribute('data-no-shell')).toBe('true');
  });

  it('desktop: clicking second card swaps the sheet without navigation', async () => {
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-seoul')).toBeTruthy());
    fireEvent.click(screen.getByTestId('trips-list-card-seoul'));
    await waitFor(() => {
      const embedded = screen.getAllByTestId('embedded-trip-page')[0];
      return embedded?.getAttribute('data-trip-id') === 'seoul';
    });
    // First card should now NOT be active
    expect(screen.getByTestId('trips-list-card-okinawa').className).not.toContain('is-active');
    expect(screen.getByTestId('trips-list-card-seoul').className).toContain('is-active');
  });

  it('mobile + no ?selected: card grid renders, no embedded TripPage in main', async () => {
    mockMatchMedia(false);
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-okinawa')).toBeTruthy());
    expect(screen.queryByTestId('embedded-trip-page')).toBeNull();
  });

  it('mobile + ?selected=okinawa: embedded TripPage replaces card grid', async () => {
    mockMatchMedia(false);
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips?selected=okinawa']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('embedded-trip-page')).toBeTruthy());
    expect(screen.getByTestId('embedded-trip-page').getAttribute('data-trip-id')).toBe('okinawa');
    // Card grid should NOT render in main (it's been replaced)
    expect(screen.queryByTestId('trips-list-card-okinawa')).toBeNull();
  });

  it('mobile click on card sets ?selected (no navigation, no /trip route)', async () => {
    mockMatchMedia(false);
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-okinawa')).toBeTruthy());
    fireEvent.click(screen.getByTestId('trips-list-card-okinawa'));
    await waitFor(() => expect(screen.queryByTestId('embedded-trip-page')).toBeTruthy());
    expect(screen.getByTestId('embedded-trip-page').getAttribute('data-trip-id')).toBe('okinawa');
  });

  it('error state on /api/my-trips 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url === '/api/my-trips') return Promise.resolve(new Response('boom', { status: 500 }));
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    }));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-error')).toBeTruthy());
  });
});
