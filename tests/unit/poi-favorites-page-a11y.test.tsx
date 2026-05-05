/**
 * PoiFavoritesPage accessibility test
 *
 * 對齊 DESIGN.md L662-665：
 *   - role="group" + aria-pressed (not tablist/aria-selected)
 *   - 每個 checkbox aria-label 帶 row context (含 POI 名稱)
 *   - search input aria-label="搜尋收藏"
 *   - bulk toolbar role="region" + aria-label="批次操作"
 *   - error block role="alert"
 *   - loading container aria-busy + aria-live="polite"
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

function makeRow(id: number, name = `POI ${id}`) {
  return {
    id,
    poiId: id * 100,
    poiName: name,
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

describe('PoiFavoritesPage — a11y', () => {
  it('search input aria-label="搜尋收藏"', async () => {
    apiFetchMock.mockResolvedValue([makeRow(1)]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-search-input')).toBeTruthy());
    const input = screen.getByTestId('favorites-search-input');
    expect(input.getAttribute('aria-label')).toBe('搜尋收藏');
    expect(input.getAttribute('type')).toBe('search');
  });

  it('每個 checkbox aria-label 帶 POI name (row context)', async () => {
    apiFetchMock.mockResolvedValue([
      makeRow(1, '五十嵐拉麵'),
      makeRow(2, '美麗海水族館'),
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-check-1')).toBeTruthy());
    expect(screen.getByTestId('favorites-check-1').getAttribute('aria-label'))
      .toBe('選取 五十嵐拉麵 收藏');
    expect(screen.getByTestId('favorites-check-2').getAttribute('aria-label'))
      .toBe('選取 美麗海水族館 收藏');
  });

  it('SHALL NOT use role="tablist" or aria-selected on filter chips', async () => {
    apiFetchMock.mockResolvedValue([makeRow(1)]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-page')).toBeTruthy());
    expect(document.querySelectorAll('[role="tablist"]').length).toBe(0);
    expect(document.querySelectorAll('.favorites-type-row [aria-selected]').length).toBe(0);
    expect(document.querySelectorAll('.favorites-region-row [aria-selected]').length).toBe(0);
  });

  it('error block role="alert"', async () => {
    apiFetchMock.mockRejectedValue(new Error('5xx'));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-error')).toBeTruthy());
    expect(screen.getByTestId('favorites-error').getAttribute('role')).toBe('alert');
  });

  it('bulk toolbar role="region" + aria-label="批次操作"', async () => {
    apiFetchMock.mockResolvedValue([makeRow(1)]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-card-1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('favorites-check-1'));
    const toolbar = screen.getByTestId('favorites-toolbar');
    expect(toolbar.getAttribute('role')).toBe('region');
    expect(toolbar.getAttribute('aria-label')).toBe('批次操作');
  });

  it('TitleBar action button aria-label="探索"', async () => {
    apiFetchMock.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-explore-titlebar')).toBeTruthy());
    expect(screen.getByTestId('favorites-explore-titlebar').getAttribute('aria-label')).toBe('探索');
  });
});
