/**
 * PoiFavoritesPage 8-state matrix + region pill + a11y unit test
 *
 * 對齊 DESIGN.md L645-665 + docs/design-sessions/2026-05-04-favorites-redesign.html mockup v4：
 *   8 states: loading / empty-pool / filter-no-results / error / data /
 *             optimistic-delete / bulk-action-busy / pagination
 *   region pill row + type filter row 用 role="group" + aria-pressed (NOT role="tablist")
 *   a11y: role="alert" on error, aria-busy on loading, aria-live on optimistic
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

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import PoiFavoritesPage from '../../src/pages/PoiFavoritesPage';

const SAMPLE_ROW = {
  id: 1,
  poiId: 100,
  poiName: 'MARUMARO 北谷店',
  poiAddress: '沖縄県中頭郡北谷町',
  poiType: 'restaurant',
  poiRegion: '沖繩',
  favoritedAt: '2026-04-01T00:00:00Z',
  note: null,
  usages: [{ tripId: 't1', tripName: '沖繩 7 日', dayNum: 2, dayDate: '2026-07-26', entryId: 200 }],
};

function makeRow(id: number, overrides: Record<string, unknown> = {}) {
  return { ...SAMPLE_ROW, id, poiId: id * 100, poiName: `POI ${id}`, ...overrides };
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
  navigateMock.mockReset();
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] }) as typeof fetch;
});

describe('PoiFavoritesPage — 8-state matrix', () => {
  it('TitleBar title 是「收藏」(統一 nav label)，hero eyebrow 補回「我的收藏」', async () => {
    apiFetchMock.mockResolvedValue([SAMPLE_ROW]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-page')).toBeTruthy());
    // TitleBar 中間 title — 統一「收藏」(per DESIGN.md L298+L633)
    const titlebarTitle = document.querySelector('.tp-titlebar-title');
    expect(titlebarTitle?.textContent).toBe('收藏');
    // hero eyebrow 補回 ownership 「我的收藏」
    const eyebrow = screen.getByTestId('favorites-eyebrow');
    expect(eyebrow.textContent).toContain('我的收藏');
  });

  it('state=loading: aria-busy="true" + aria-live="polite" on main container', () => {
    apiFetchMock.mockReturnValue(new Promise(() => {})); // pending
    renderPage();
    const main = screen.getByTestId('favorites-loading');
    expect(main.getAttribute('aria-busy')).toBe('true');
    expect(main.getAttribute('aria-live')).toBe('polite');
  });

  it('state=empty-pool: data-testid="favorites-empty" + 「去探索」CTA', async () => {
    apiFetchMock.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-empty')).toBeTruthy());
    expect(screen.getByTestId('favorites-empty-explore')).toBeTruthy();
  });

  it('state=filter-no-results: data + 篩選後無 match → favorites-no-match + 清除篩選 button', async () => {
    apiFetchMock.mockResolvedValue([makeRow(1, { poiType: 'restaurant', poiRegion: '沖繩' })]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-card-1')).toBeTruthy());
    // 切到「景點」filter — restaurant row 不 match
    fireEvent.click(screen.getByTestId('favorites-type-attraction'));
    await waitFor(() => expect(screen.getByTestId('favorites-no-match')).toBeTruthy());
    // 清除篩選 secondary action
    expect(screen.getByTestId('favorites-clear-filters')).toBeTruthy();
  });

  it('state=error: role="alert" + retry button', async () => {
    apiFetchMock.mockRejectedValue(new Error('5xx'));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-error')).toBeTruthy());
    const errorBlock = screen.getByTestId('favorites-error');
    expect(errorBlock.getAttribute('role')).toBe('alert');
    expect(screen.getByTestId('favorites-error-retry')).toBeTruthy();
  });

  it('state=data: grid + per-card add-to-trip link 永遠存在', async () => {
    apiFetchMock.mockResolvedValue([makeRow(1), makeRow(2)]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-card-1')).toBeTruthy());
    expect(screen.getByTestId('favorites-add-to-trip-1')).toBeTruthy();
    expect(screen.getByTestId('favorites-add-to-trip-2')).toBeTruthy();
  });

  it('state=optimistic-delete: deleting card 加 aria-live="polite"', async () => {
    apiFetchMock.mockImplementation((path) => {
      if (path === '/poi-favorites') return Promise.resolve([makeRow(1)]);
      // DELETE — pending
      return new Promise(() => {});
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-card-1')).toBeTruthy());
    // select + delete
    fireEvent.click(screen.getByTestId('favorites-check-1'));
    fireEvent.click(screen.getByTestId('favorites-delete-selected'));
    // confirm modal
    await waitFor(() => expect(screen.getByTestId('confirm-modal-confirm')).toBeTruthy());
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    // card 進 deleting state
    await waitFor(() => {
      const card = screen.getByTestId('favorites-card-1');
      expect(card.className).toContain('is-deleting');
      expect(card.getAttribute('aria-live')).toBe('polite');
    });
  });

  it('state=bulk-action-busy: toolbar role="region" + aria-label="批次操作" + delete button 顯示「刪除中」', async () => {
    apiFetchMock.mockImplementation((path) => {
      if (path === '/poi-favorites') return Promise.resolve([makeRow(1), makeRow(2)]);
      return new Promise(() => {});
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-card-1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('favorites-check-1'));
    fireEvent.click(screen.getByTestId('favorites-check-2'));
    const toolbar = screen.getByTestId('favorites-toolbar');
    expect(toolbar.getAttribute('role')).toBe('region');
    expect(toolbar.getAttribute('aria-label')).toBe('批次操作');
    fireEvent.click(screen.getByTestId('favorites-delete-selected'));
    await waitFor(() => expect(screen.getByTestId('confirm-modal-confirm')).toBeTruthy());
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    await waitFor(() => {
      expect(screen.getByTestId('favorites-delete-selected').textContent).toContain('刪除中');
    });
  });

  it('state=pagination: ≥200 favorites → sticky search + pagination nav', async () => {
    const rows = Array.from({ length: 247 }, (_, i) => makeRow(i + 1));
    apiFetchMock.mockResolvedValue(rows);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-page')).toBeTruthy());
    expect(screen.getByTestId('favorites-pagination')).toBeTruthy();
    const pagination = screen.getByTestId('favorites-pagination');
    expect(pagination.getAttribute('aria-label')).toBe('分頁');
  });
});
