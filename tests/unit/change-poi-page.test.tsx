import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ChangePoiPage from '../../src/pages/ChangePoiPage';
import type { PoiSearchResult } from '../../src/types/poi';

const navigateSpy = vi.fn();
const mockPoiSearch = vi.hoisted(() => ({
  results: [] as PoiSearchResult[],
  lastOptions: null as null | {
    query: string;
    normalise?: (raw: unknown) => PoiSearchResult[];
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { email: 'user@test.com' }, loading: false }),
}));

vi.mock('../../src/hooks/useNavigateBack', () => ({
  useNavigateBack: (_fallback: string) => () => navigateSpy('back'),
}));

vi.mock('../../src/hooks/usePoiSearch', () => ({
  usePoiSearch: (options: { query: string; normalise?: (raw: unknown) => PoiSearchResult[] }) => {
    mockPoiSearch.lastOptions = options;
    return { results: mockPoiSearch.results, searching: false };
  },
}));

vi.mock('../../src/components/shell/AppShell', () => ({
  default: ({ main }: { main: React.ReactNode }) => <>{main}</>,
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({
  default: () => null,
}));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({
  default: () => null,
}));

vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: vi.fn(),
  apiFetchRaw: vi.fn(),
}));

import { apiFetch, apiFetchRaw } from '../../src/lib/apiClient';

function renderPage(path = '/trip/okinawa-2026/stop/42/change-poi?mode=alternate') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/trip/:tripId/stop/:entryId/change-poi" element={<ChangePoiPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  navigateSpy.mockClear();
  mockPoiSearch.results = [];
  mockPoiSearch.lastOptions = null;
  (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (apiFetchRaw as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    status: 201,
    text: () => Promise.resolve(''),
  } as unknown as Response);
});

describe('ChangePoiPage — alternate mode', () => {
  it('shows both search and favorites tabs', () => {
    renderPage();
    expect(screen.getByTestId('change-poi-tab-search')).toBeTruthy();
    expect(screen.getByTestId('change-poi-tab-favorites')).toBeTruthy();
    expect(screen.queryByText(/只支援從收藏/)).toBeNull();
  });

  it('tab=favorites opens the same alternate page on the favorites tab', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderPage('/trip/okinawa-2026/stop/42/change-poi?mode=alternate&tab=favorites');
    expect(screen.getByTestId('change-poi-tab-favorites').className).toContain('is-active');
    expect(screen.queryByTestId('change-poi-search-input')).toBeNull();
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/poi-favorites');
    });
  });

  it('can add a searched POI as an alternate', async () => {
    mockPoiSearch.results = [{
      place_id: 'ChIJ-alt-search',
      name: '新搜尋餐廳',
      address: '沖繩縣',
      lat: 26.2,
      lng: 127.7,
      category: 'restaurant',
      country: 'JP',
      rating: 4.4,
    }];
    renderPage();

    fireEvent.click(screen.getByTestId('change-poi-search-item-ChIJ-alt-search'));
    fireEvent.click(screen.getByTestId('change-poi-submit'));

    await waitFor(() => {
      expect(apiFetchRaw).toHaveBeenCalledWith(
        '/trips/okinawa-2026/entries/42/alternates',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    const call = (apiFetchRaw as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body).toMatchObject({
      name: '新搜尋餐廳',
      lat: 26.2,
      lng: 127.7,
      type: 'restaurant',
      category: 'restaurant',
      address: '沖繩縣',
      rating: 4.4,
      country: 'JP',
      source: 'google',
    });
  });

  it('can add a favorite POI as an alternate from the same screen', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 9,
        userId: 'user-1',
        poiId: 321,
        favoritedAt: '2026-05-13T00:00:00Z',
        poiName: '收藏景點',
        poiAddress: '那霸',
        poiLat: 26.1,
        poiLng: 127.6,
        poiType: 'attraction',
      },
    ]);
    renderPage();

    fireEvent.click(screen.getByTestId('change-poi-tab-favorites'));
    await waitFor(() => {
      expect(screen.queryByTestId('change-poi-favorite-item-9')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('change-poi-favorite-item-9'));
    fireEvent.click(screen.getByTestId('change-poi-submit'));

    await waitFor(() => {
      expect(apiFetchRaw).toHaveBeenCalledWith(
        '/trips/okinawa-2026/entries/42/alternates',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    const call = (apiFetchRaw as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body).toEqual({ poiId: 321 });
  });
});

describe('ChangePoiPage — master search mode', () => {
  it('normalises wrapped /api/poi-search results and keeps the search input editable', () => {
    renderPage('/trip/okinawa-2026/stop/42/change-poi');

    const input = screen.getByTestId('change-poi-search-input') as HTMLInputElement;
    expect(input.type).toBe('text');
    fireEvent.change(input, { target: { value: '美國村' } });
    expect(input.value).toBe('美國村');

    const rows = mockPoiSearch.lastOptions?.normalise?.({
      results: [{
        place_id: 'ChIJzZoVCAUT5TQRzIueHYt83hs',
        name: '美國村',
        address: 'Mihama, Chatan',
        lat: 26.3158799,
        lng: 127.7540077,
        category: 'tourist_attraction',
        country: 'JP',
        rating: 4.3,
      }],
    });
    expect(rows).toEqual([expect.objectContaining({ name: '美國村' })]);
  });
});
