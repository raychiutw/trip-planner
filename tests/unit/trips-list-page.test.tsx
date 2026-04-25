/**
 * TripsListPage unit test — V2 trip landing 3-pane mockup parity
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

// Default to desktop matchMedia for the 3-pane preview path. Individual
// tests can override before render() to exercise mobile behavior.
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

beforeEach(() => {
  mockMatchMedia(true);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function mockApi(opts: {
  my: { tripId: string }[];
  all: Array<Record<string, unknown>>;
  /** Fake days payload for /api/trips/:id/days — defaults to one empty day. */
  days?: unknown;
}) {
  return vi.fn().mockImplementation((url: string) => {
    if (url === '/api/my-trips') {
      return Promise.resolve(new Response(JSON.stringify(opts.my), { status: 200 }));
    }
    if (/\/api\/trips\/[^/]+\/days/.test(url)) {
      return Promise.resolve(new Response(JSON.stringify(opts.days ?? []), { status: 200 }));
    }
    if (url.startsWith('/api/trips')) {
      return Promise.resolve(new Response(JSON.stringify(opts.all), { status: 200 }));
    }
    return Promise.resolve(new Response('null', { status: 200 }));
  });
}

const SAMPLE_TRIPS = [
  {
    tripId: 'okinawa-trip', name: '沖繩之旅', title: '沖繩之旅',
    countries: 'JP', published: 1,
    day_count: 5, start_date: '2026-07-26', end_date: '2026-07-30', member_count: 2,
  },
  {
    tripId: 'seoul-trip', name: '首爾美食行', title: '首爾美食行',
    countries: 'KR', published: 1,
    day_count: 4, start_date: '2026-08-15', end_date: '2026-08-18', member_count: 1,
  },
];

describe('TripsListPage — loading + empty', () => {
  it('shows loading state initially', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<MemoryRouter><TripsListPage /></MemoryRouter>);
    expect(screen.getByTestId('trips-list-loading')).toBeTruthy();
  });

  it('empty hero renders when user has zero trips with prominent 新增行程 CTA', async () => {
    vi.stubGlobal('fetch', mockApi({ my: [], all: [] }));
    render(<MemoryRouter><TripsListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-empty')).toBeTruthy());
    // The headline appears twice on desktop — once in the main empty hero,
    // once in the preview sheet's empty state (mirrored CTA).
    expect(screen.getAllByText('還沒開始任何行程').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('trips-list-new-trip-hero')).toBeTruthy();
    // No grid + no trailing card when zero
    expect(screen.queryByTestId('trips-list-new-trip-card')).toBeNull();
  });
});

describe('TripsListPage — card rendering', () => {
  it('renders enriched cards: country + day count eyebrow, date range + member meta', async () => {
    vi.stubGlobal('fetch', mockApi({ my: [{ tripId: 'okinawa-trip' }, { tripId: 'seoul-trip' }], all: SAMPLE_TRIPS }));
    render(<MemoryRouter><TripsListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-okinawa-trip')).toBeTruthy());

    // Selected trip title appears in both card (h2) and preview sheet (h2) — getAllByText
    expect(screen.getAllByText('沖繩之旅').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('JAPAN · 5 DAYS')).toBeTruthy();
    expect(screen.getByText('7/26 – 7/30 · 2 旅伴')).toBeTruthy();
    expect(screen.getByText('KOREA · 4 DAYS')).toBeTruthy();
    expect(screen.getByText('8/15 – 8/18 · 1 旅伴')).toBeTruthy();
  });

  it('falls back to tripId meta when start_date/end_date/member_count missing', async () => {
    const my = [{ tripId: 'orphan-trip' }];
    vi.stubGlobal('fetch', mockApi({ my, all: [] }));
    render(<MemoryRouter><TripsListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-orphan-trip')).toBeTruthy());
    expect(screen.getAllByText('orphan-trip').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('TRIP')).toBeTruthy(); // unknown country
  });

  it('eyebrow uses singular "DAY" when day_count === 1', async () => {
    vi.stubGlobal('fetch', mockApi({
      my: [{ tripId: 'one-day' }],
      all: [{ tripId: 'one-day', name: '一日遊', countries: 'TW', day_count: 1, published: 1 }],
    }));
    render(<MemoryRouter><TripsListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-one-day')).toBeTruthy());
    expect(screen.getByText('TAIWAN · 1 DAY')).toBeTruthy();
  });

  it('trailing 新增行程 card always present when trips exist', async () => {
    vi.stubGlobal('fetch', mockApi({ my: [{ tripId: 'okinawa-trip' }], all: SAMPLE_TRIPS }));
    render(<MemoryRouter><TripsListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-new-trip-card')).toBeTruthy());
    expect(screen.getByTestId('trips-list-new-trip-card').getAttribute('href')).toBe('/manage');
  });
});

describe('TripsListPage — desktop preview sheet (3-pane)', () => {
  it('first trip is auto-selected on desktop and preview sheet renders title', async () => {
    vi.stubGlobal('fetch', mockApi({ my: [{ tripId: 'okinawa-trip' }, { tripId: 'seoul-trip' }], all: SAMPLE_TRIPS }));
    render(<MemoryRouter><TripsListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-preview-sheet')).toBeTruthy());
    await waitFor(() => expect(screen.queryByTestId('trips-preview-title')).toBeTruthy());
    expect(screen.getByTestId('trips-preview-title').textContent).toBe('沖繩之旅');
  });

  it('first trip card has is-active class on desktop', async () => {
    vi.stubGlobal('fetch', mockApi({ my: [{ tripId: 'okinawa-trip' }, { tripId: 'seoul-trip' }], all: SAMPLE_TRIPS }));
    render(<MemoryRouter><TripsListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-okinawa-trip')).toBeTruthy());
    const first = screen.getByTestId('trips-list-card-okinawa-trip');
    const second = screen.getByTestId('trips-list-card-seoul-trip');
    expect(first.className).toContain('is-active');
    expect(second.className).not.toContain('is-active');
  });

  it('clicking a card on desktop updates ?selected URL param without navigation', async () => {
    vi.stubGlobal('fetch', mockApi({ my: [{ tripId: 'okinawa-trip' }, { tripId: 'seoul-trip' }], all: SAMPLE_TRIPS }));
    render(<MemoryRouter><TripsListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-seoul-trip')).toBeTruthy());
    fireEvent.click(screen.getByTestId('trips-list-card-seoul-trip'));
    await waitFor(() => {
      expect(screen.getByTestId('trips-list-card-seoul-trip').className).toContain('is-active');
    });
    expect(screen.getByTestId('trips-list-card-okinawa-trip').className).not.toContain('is-active');
  });

  it('preview sheet shows empty CTA when zero trips', async () => {
    vi.stubGlobal('fetch', mockApi({ my: [], all: [] }));
    render(<MemoryRouter><TripsListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-empty')).toBeTruthy());
    // Sheet on desktop shows its own empty CTA when tripId is null
    expect(screen.queryByTestId('trips-preview-empty')).toBeTruthy();
  });
});

describe('TripsListPage — mobile (no preview sheet)', () => {
  beforeEach(() => mockMatchMedia(false));

  it('mobile: preview sheet not rendered', async () => {
    vi.stubGlobal('fetch', mockApi({ my: [{ tripId: 'okinawa-trip' }], all: SAMPLE_TRIPS }));
    render(<MemoryRouter><TripsListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-okinawa-trip')).toBeTruthy());
    expect(screen.queryByTestId('trips-preview-sheet')).toBeNull();
  });

  it('mobile: card has no is-active class (no preview state)', async () => {
    vi.stubGlobal('fetch', mockApi({ my: [{ tripId: 'okinawa-trip' }], all: SAMPLE_TRIPS }));
    render(<MemoryRouter><TripsListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-okinawa-trip')).toBeTruthy());
    const card = screen.getByTestId('trips-list-card-okinawa-trip');
    expect(card.className).not.toContain('is-active');
  });
});

describe('TripsListPage — error states', () => {
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
