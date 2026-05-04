/**
 * AddPoiFavoriteToTripPage TitleBar + responsive layout test (§12.5 + §12.7)
 *
 * 對齊 mockup B1/B2 + DESIGN.md L266-273：
 *   - TitleBar 左側 36×36 chevron-left back button + aria-label
 *   - TitleBar 中間 「加入行程」 title 靠左 (flex:1)
 *   - TitleBar 右側 SHALL NOT 含 primary confirm action（與 mockup「主 CTA 改放 form 下方」一致）
 *   - desktop ≥1024 用 .tp-form-grid-2col (max-width 720px)
 *   - phone ≤760 stack 單欄 + button full-width (CSS breakpoint 規範)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
}));

vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', email: 'ray@x.com' }, reload: () => {} }),
}));
vi.mock('../../src/hooks/useNavigateBack', () => ({
  useNavigateBack: () => () => {},
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

import AddPoiFavoriteToTripPage from '../../src/pages/AddPoiFavoriteToTripPage';

const SAMPLE_FAVORITE = {
  id: 5,
  poiId: 100,
  poiName: 'POI test',
  poiAddress: 'addr',
  poiType: 'restaurant',
  favoritedAt: '2026-04-01T00:00:00Z',
  note: null,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/favorites/5/add-to-trip']}>
      <Routes>
        <Route path="/favorites/:id/add-to-trip" element={<AddPoiFavoriteToTripPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((path) => {
    if (path === '/poi-favorites') return Promise.resolve([SAMPLE_FAVORITE]);
    if (path === '/my-trips') return Promise.resolve([{ tripId: 't1', name: 'T1', totalDays: 3 }]);
    if (path.startsWith('/trips/t1')) return Promise.resolve({ days: [{ dayNum: 1, date: '2026-07-26', label: 'D1' }] });
    return Promise.resolve({});
  });
});

describe('AddPoiFavoriteToTripPage — TitleBar', () => {
  it('TitleBar 左側 back button (.tp-titlebar-back)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy());
    const back = document.querySelector('.tp-titlebar-back');
    expect(back).toBeTruthy();
  });

  it('TitleBar title「加入行程」', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy());
    const title = document.querySelector('.tp-titlebar-title');
    expect(title?.textContent).toContain('加入行程');
  });

  it('TitleBar 右側 SHALL NOT 含 primary confirm action', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy());
    const titlebar = document.querySelector('.tp-titlebar');
    expect(titlebar).toBeTruthy();
    // 整 titlebar 不該有任何 primary action button
    const primaryAction = titlebar?.querySelector('.tp-titlebar-action.is-primary, [data-testid="favorites-add-to-trip-submit"]');
    expect(primaryAction).toBeNull();
  });
});

describe('AddPoiFavoriteToTripPage — 2-col grid layout', () => {
  it('form 用 .tp-form-grid-2col CSS class (desktop 2-col)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-trip')).toBeTruthy());
    // form wrapper 必含 .tp-form-grid-2col
    const grid = document.querySelector('.tp-form-grid-2col');
    expect(grid).toBeTruthy();
  });

  it('startTime + endTime 包在同一 .tp-form-row-pair (mockup 規範並排)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-add-to-trip-start')).toBeTruthy());
    const startInput = screen.getByTestId('favorites-add-to-trip-start');
    const endInput = screen.getByTestId('favorites-add-to-trip-end');
    // 兩 input 共 nearest .tp-form-row-pair ancestor
    const pair = startInput.closest('.tp-form-row-pair');
    expect(pair).toBeTruthy();
    expect(pair?.contains(endInput)).toBe(true);
  });
});
