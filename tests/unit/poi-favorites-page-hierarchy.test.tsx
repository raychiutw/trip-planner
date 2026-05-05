/**
 * PoiFavoritesPage hierarchy test (數量分檔)
 *
 * 對齊 mockup v4 hero hierarchy：
 *   - 0 favorites → 顯示 empty CTA，filters 隱藏
 *   - 50 favorites → grid 為主，filters + search 顯示但 pagination 不出現
 *   - 200+ favorites → sticky search + pagination + filters
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
}));

vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ user: { id: 'u1', email: 'ray@x.com' }, reload: () => {} }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', email: 'ray@x.com' }, reload: () => {} }),
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

import PoiFavoritesPage from '../../src/pages/PoiFavoritesPage';

function makeRow(id: number) {
  return {
    id,
    poiId: id * 100,
    poiName: `POI ${id}`,
    poiAddress: 'addr',
    poiType: 'restaurant',
    poiRegion: '沖繩',
    favoritedAt: '2026-04-01T00:00:00Z',
    note: null,
    usages: [],
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/favorites']}>
      <PoiFavoritesPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('PoiFavoritesPage — hierarchy by count', () => {
  it('0 favorites: filters 與 search 隱藏 (empty-pool state)', async () => {
    apiFetchMock.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-empty')).toBeTruthy());
    expect(screen.queryByTestId('favorites-search-input')).toBeNull();
    expect(screen.queryByTestId('favorites-region-row')).toBeNull();
    expect(screen.queryByTestId('favorites-type-row')).toBeNull();
  });

  it('50 favorites: grid + filters + search 顯示，pagination 不出現', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => makeRow(i + 1));
    apiFetchMock.mockResolvedValue(rows);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-card-1')).toBeTruthy());
    expect(screen.getByTestId('favorites-search-input')).toBeTruthy();
    expect(screen.getByTestId('favorites-region-row')).toBeTruthy();
    expect(screen.getByTestId('favorites-type-row')).toBeTruthy();
    expect(screen.queryByTestId('favorites-pagination')).toBeNull();
  });

  it('247 favorites: sticky search + pagination + filters', async () => {
    const rows = Array.from({ length: 247 }, (_, i) => makeRow(i + 1));
    apiFetchMock.mockResolvedValue(rows);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-page')).toBeTruthy());
    expect(screen.getByTestId('favorites-search-input')).toBeTruthy();
    expect(screen.getByTestId('favorites-region-row')).toBeTruthy();
    expect(screen.getByTestId('favorites-type-row')).toBeTruthy();
    expect(screen.getByTestId('favorites-pagination')).toBeTruthy();
  });

  it('count meta 顯示總數', async () => {
    const rows = Array.from({ length: 52 }, (_, i) => makeRow(i + 1));
    apiFetchMock.mockResolvedValue(rows);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-count')).toBeTruthy());
    expect(screen.getByTestId('favorites-count').textContent).toContain('52');
  });
});
