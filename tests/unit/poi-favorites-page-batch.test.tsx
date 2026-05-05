/**
 * PoiFavoritesPage batch flow delete-only test (DUC1 sign-off)
 *
 * 對齊 DESIGN.md L639-643 「Batch flow（DUC1 sign-off — delete-only）」：
 *   - bulk select toolbar 只支援「全選 / 取消 / 刪除」三 action
 *   - SHALL NOT 含 batch add-to-trip button
 *   - per-card「加入行程 →」link 永遠是唯一 add-to-trip 入口
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

describe('PoiFavoritesPage — batch flow delete-only (DUC1)', () => {
  it('toolbar SHALL NOT 含 batch add-to-trip button', async () => {
    apiFetchMock.mockResolvedValue([makeRow(1), makeRow(2)]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-card-1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('favorites-check-1'));
    const toolbar = screen.getByTestId('favorites-toolbar');
    // SHALL NOT 含 batch add-to-trip
    expect(toolbar.querySelector('[data-testid="favorites-add-to-trip-batch"]')).toBeNull();
    // 也不該含舊版「加入行程」batch button (rid of TripPickerPopover trigger)
    expect(toolbar.textContent).not.toContain('加入行程');
  });

  it('toolbar 只含「全選 / 取消 / 刪除」三 action', async () => {
    apiFetchMock.mockResolvedValue([makeRow(1), makeRow(2)]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-card-1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('favorites-check-1'));
    expect(screen.getByTestId('favorites-select-all')).toBeTruthy();
    expect(screen.getByTestId('favorites-clear-selection')).toBeTruthy();
    expect(screen.getByTestId('favorites-delete-selected')).toBeTruthy();
  });

  it('「全選」action 一鍵選全部 visible filter 結果', async () => {
    apiFetchMock.mockResolvedValue([makeRow(1), makeRow(2), makeRow(3)]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-card-1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('favorites-check-1'));
    fireEvent.click(screen.getByTestId('favorites-select-all'));
    expect((screen.getByTestId('favorites-check-1') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('favorites-check-2') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('favorites-check-3') as HTMLInputElement).checked).toBe(true);
  });

  it('per-card add-to-trip link 永遠是 add-to-trip 唯一入口', async () => {
    apiFetchMock.mockResolvedValue([makeRow(1), makeRow(2)]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-card-1')).toBeTruthy());
    // multi-select 後仍有 per-card link
    fireEvent.click(screen.getByTestId('favorites-check-1'));
    expect(screen.getByTestId('favorites-add-to-trip-1').getAttribute('href')).toBe('/favorites/1/add-to-trip');
    expect(screen.getByTestId('favorites-add-to-trip-2').getAttribute('href')).toBe('/favorites/2/add-to-trip');
  });

  it('SHALL NOT mount TripPickerPopover (移除舊 batch trip picker UI)', async () => {
    apiFetchMock.mockResolvedValue([makeRow(1)]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-card-1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('favorites-check-1'));
    // popover 不該存在 — 整個 element 都不該掛
    expect(document.querySelector('[data-testid*="trip-picker"]')).toBeNull();
  });
});
