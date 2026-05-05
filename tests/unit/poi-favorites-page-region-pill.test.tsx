/**
 * PoiFavoritesPage region pill row + type filter row a11y test
 *
 * 對齊 DESIGN.md L662 + mockup A1:
 *   - .favorites-region-row + role="group" + aria-label="地區篩選"
 *   - .favorites-type-row + role="group" + aria-label="POI 類型篩選"
 *   - 每 chip aria-pressed="true|false" (NOT aria-selected — 不是 tab 切換)
 *   - region 選擇影響 grid 篩選
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

function makeRow(id: number, region: string, type = 'restaurant') {
  // region 寫進 poiAddress 字串供 deriveRegion 解析（server 無 region field，client-side derive）
  // 「沖繩」→ 寫「沖縄」(JP shinjitai) 確保 /沖縄|沖繩/ 兩種寫法 derive 對齊
  const addrKeyword = region === '沖繩' ? '沖縄' : region;
  return {
    id,
    poiId: id * 100,
    poiName: `POI ${id} (${region})`,
    poiAddress: `${addrKeyword}縣 demo address`,
    poiType: type,
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

describe('PoiFavoritesPage — region pill + type filter a11y', () => {
  it('region pill wrapper role="group" + aria-label="地區篩選"', async () => {
    apiFetchMock.mockResolvedValue([makeRow(1, '沖繩'), makeRow(2, '京都')]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-region-row')).toBeTruthy());
    const row = screen.getByTestId('favorites-region-row');
    expect(row.getAttribute('role')).toBe('group');
    expect(row.getAttribute('aria-label')).toBe('地區篩選');
  });

  it('type filter row role="group" + aria-label="POI 類型篩選" (不是 tablist)', async () => {
    apiFetchMock.mockResolvedValue([makeRow(1, '沖繩')]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-type-row')).toBeTruthy());
    const row = screen.getByTestId('favorites-type-row');
    expect(row.getAttribute('role')).toBe('group');
    expect(row.getAttribute('role')).not.toBe('tablist');
    expect(row.getAttribute('aria-label')).toBe('POI 類型篩選');
  });

  it('region pill chip 用 aria-pressed (不是 aria-selected)', async () => {
    apiFetchMock.mockResolvedValue([makeRow(1, '沖繩')]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-region-all')).toBeTruthy());
    const allChip = screen.getByTestId('favorites-region-all');
    expect(allChip.hasAttribute('aria-pressed')).toBe(true);
    expect(allChip.hasAttribute('aria-selected')).toBe(false);
  });

  it('region 選擇切換篩選 grid', async () => {
    apiFetchMock.mockResolvedValue([
      makeRow(1, '沖繩'),
      makeRow(2, '京都'),
      makeRow(3, '沖繩'),
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-card-1')).toBeTruthy());
    expect(screen.getByTestId('favorites-card-1')).toBeTruthy();
    expect(screen.getByTestId('favorites-card-2')).toBeTruthy();
    expect(screen.getByTestId('favorites-card-3')).toBeTruthy();
    // 點「京都」chip
    fireEvent.click(screen.getByTestId('favorites-region-京都'));
    await waitFor(() => {
      expect(screen.queryByTestId('favorites-card-1')).toBeNull();
      expect(screen.getByTestId('favorites-card-2')).toBeTruthy();
      expect(screen.queryByTestId('favorites-card-3')).toBeNull();
    });
  });

  it('region pill 顯示 count badge (該 region 有幾個 POI)', async () => {
    apiFetchMock.mockResolvedValue([
      makeRow(1, '沖繩'),
      makeRow(2, '沖繩'),
      makeRow(3, '京都'),
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('favorites-region-row')).toBeTruthy());
    const okinawa = screen.getByTestId('favorites-region-沖繩');
    expect(okinawa.textContent).toContain('沖繩');
    expect(okinawa.textContent).toContain('2');
    const kyoto = screen.getByTestId('favorites-region-京都');
    expect(kyoto.textContent).toContain('1');
  });
});
