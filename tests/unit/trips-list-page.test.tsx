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
  // mockup-parity-qa-fixes: API 透過 deepCamel() 回 camelCase；test mock 跟 prod response shape 一致
  { tripId: 'okinawa', name: '沖繩之旅', title: '沖繩之旅', countries: 'JP', published: 1, dayCount: 5, startDate: '2026-07-26', endDate: '2026-07-30', memberCount: 2 },
  { tripId: 'seoul', name: '首爾美食行', title: '首爾美食行', countries: 'KR', published: 1, dayCount: 4, startDate: '2026-08-15', endDate: '2026-08-18', memberCount: 1 },
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
    // Section 4.7 (terracotta-ui-parity-polish): eyebrow 中文化「日本 · N 天」對齊 mockup
    expect(screen.getByText('日本 · 5 天')).toBeTruthy();
    // mockup-parity-qa-fixes: cardMeta 改「{M}/{D} 出發 · {range}」格式（mockup section 16:6908）
    expect(screen.getByText('7/26 出發 · 7/26 – 7/30')).toBeTruthy();
    expect(screen.getByText('韓國 · 4 天')).toBeTruthy();
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

  it('desktop + no ?selected: card grid renders, no embedded TripPage (PR-PP)', async () => {
    // PR-PP 2026-04-26：架構改 2-pane (sidebar + main，去 sheet)。
    // /trips landing 不再自動選第一筆 + 開 sheet — user 看到的是 card grid。
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-okinawa')).toBeTruthy());
    expect(screen.queryByTestId('embedded-trip-page')).toBeNull();
  });

  it('desktop + ?selected=seoul: embedded TripPage replaces grid 滿版 (PR-PP)', async () => {
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips?selected=seoul']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('embedded-trip-page')).toBeTruthy());
    expect(screen.getByTestId('embedded-trip-page').getAttribute('data-trip-id')).toBe('seoul');
    expect(screen.getByTestId('embedded-trip-page').getAttribute('data-no-shell')).toBe('true');
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

describe('TripsListPage — Section 4.7 toolbar (filter/sort/search/owner)', () => {
  const sample = [
    // u@x.com 是 mock current user → owner === user → 我的
    // mockup-parity-qa-fixes: API 透過 deepCamel() 回 camelCase
    { tripId: 'okinawa', name: '沖繩', title: '沖繩', countries: 'JP', published: 1, dayCount: 5, memberCount: 2, owner: 'u@x.com' },
    // 不同 owner → 共編
    { tripId: 'seoul', name: '首爾', title: '首爾', countries: 'KR', published: 1, dayCount: 4, memberCount: 1, owner: 'friend@x.com' },
    { tripId: 'taipei', name: '台北', title: '台北', countries: 'TW', published: 1, dayCount: 3, memberCount: 1, owner: 'u@x.com' },
  ];

  it('toolbar 顯示三個 filter tab + sort dropdown + search toggle', async () => {
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }, { tripId: 'taipei' }], sample));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-toolbar')).toBeTruthy());
    expect(screen.getByTestId('trips-list-tab-all')).toBeTruthy();
    expect(screen.getByTestId('trips-list-tab-mine')).toBeTruthy();
    expect(screen.getByTestId('trips-list-tab-collab')).toBeTruthy();
    expect(screen.getByTestId('trips-list-sort')).toBeTruthy();
    expect(screen.getByTestId('trips-list-search-toggle')).toBeTruthy();
  });

  it('filter tab「我的」只顯示 owner === current user 的 trip', async () => {
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }, { tripId: 'taipei' }], sample));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-tab-mine')).toBeTruthy());
    fireEvent.click(screen.getByTestId('trips-list-tab-mine'));
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-okinawa')).toBeTruthy());
    expect(screen.queryByTestId('trips-list-card-okinawa')).toBeTruthy();
    expect(screen.queryByTestId('trips-list-card-taipei')).toBeTruthy();
    expect(screen.queryByTestId('trips-list-card-seoul')).toBeNull();
  });

  it('filter tab「共編」只顯示 owner !== current user 的 trip', async () => {
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }, { tripId: 'taipei' }], sample));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-tab-collab')).toBeTruthy());
    fireEvent.click(screen.getByTestId('trips-list-tab-collab'));
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-seoul')).toBeTruthy());
    expect(screen.queryByTestId('trips-list-card-seoul')).toBeTruthy();
    expect(screen.queryByTestId('trips-list-card-okinawa')).toBeNull();
  });

  it('search toggle expand → input 出現 + 過濾後 count 顯示', async () => {
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }, { tripId: 'taipei' }], sample));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-search-toggle')).toBeTruthy());
    expect(screen.queryByTestId('trips-list-search-input')).toBeNull();
    fireEvent.click(screen.getByTestId('trips-list-search-toggle'));
    await waitFor(() => expect(screen.queryByTestId('trips-list-search-input')).toBeTruthy());
    fireEvent.change(screen.getByTestId('trips-list-search-input'), { target: { value: '沖繩' } });
    await waitFor(() => expect(screen.queryByTestId('trips-list-search-count')).toBeTruthy());
    expect(screen.getByTestId('trips-list-search-count').textContent).toContain('1');
  });

  it('owner avatar 顯示「由你建立」/ owner email username', async () => {
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }], sample));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-owner-okinawa')).toBeTruthy());
    expect(screen.getByTestId('trips-list-card-owner-okinawa').textContent).toContain('由你建立');
    expect(screen.getByTestId('trips-list-card-owner-seoul').textContent).toContain('friend');
  });
});
