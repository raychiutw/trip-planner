/**
 * ExplorePage smoke tests — B-P4 search + saved pool.
 *
 * Mock fetch + apiFetch to avoid network calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
}));

vi.mock('../../src/components/shared/Toast', () => ({
  default: () => null,
  showToast: vi.fn(),
}));

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
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

import ExplorePage from '../../src/pages/ExplorePage';

function renderPage() {
  return render(
    <MemoryRouter>
      <ExplorePage />
    </MemoryRouter>,
  );
}

describe('ExplorePage', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((path: string) => {
      if (path === '/saved-pois') return Promise.resolve([]);
      return Promise.resolve({});
    });
    global.fetch = vi.fn();
  });

  it('renders search input + empty saved view when 切換 to 我的收藏 view', async () => {
    const { getByTestId, findByText } = renderPage();
    expect(getByTestId('explore-page')).toBeTruthy();
    expect(getByTestId('explore-search-input')).toBeTruthy();
    // Section 4.9: TitleBar action 「我的收藏」 button toggle 取代既有 tab pair
    fireEvent.click(getByTestId('explore-saved-titlebar'));
    expect(await findByText(/還沒有儲存任何 POI/)).toBeTruthy();
  });

  it('shows error toast when search query < 2 chars', () => {
    /* 2026-04-29 (E5):mount 後 auto runSearch with default region seed
     * → fetch 已被 call 一次。Test 改驗 user input < 2 字 click submit
     * 不會 trigger 第二次 fetch(維持 fetch call count = 1,不是 2)。 */
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });
    const { getByTestId } = renderPage();
    const initialFetchCount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    const input = getByTestId('explore-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    // showToast is mocked — assertion via no NEW network call after submit
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(initialFetchCount);
  });

  it('calls /api/poi-search on valid submit + renders results', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { osm_id: 1, name: '沖繩水族館', address: 'Japan', lat: 26.6941, lng: 127.8778, category: 'tourism' },
        ],
      }),
    });
    const { getByTestId, findByText } = renderPage();
    const input = getByTestId('explore-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '沖繩' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    expect(await findByText('沖繩水族館')).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/poi-search?q='));
  });

  it('save button triggers find-or-create + saved-pois POST', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        results: [{ osm_id: 99, name: 'Test POI', address: 'Addr', lat: 25, lng: 121, category: 'food' }],
      }),
    });
    apiFetchMock.mockImplementation((path: string) => {
      if (path === '/saved-pois') return Promise.resolve([]);
      if (path === '/pois/find-or-create') return Promise.resolve({ id: 42 });
      return Promise.resolve({});
    });

    const { getByTestId, findByTestId } = renderPage();
    const input = getByTestId('explore-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.click(getByTestId('explore-search-submit'));

    const saveBtn = await findByTestId('explore-save-btn-99');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/pois/find-or-create',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/saved-pois',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});

describe('ExplorePage — Section 4.9 card cover + region + subtabs', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((path: string) => {
      if (path === '/saved-pois') return Promise.resolve([]);
      return Promise.resolve({});
    });
    global.fetch = vi.fn();
  });

  it('region pill 顯示「全部地區 ▾」 default', () => {
    const { getByTestId } = renderPage();
    const pill = getByTestId('explore-region-pill');
    expect(pill.textContent).toContain('全部地區');
  });

  it('5 個 subtab chip 渲染：為你推薦 / 景點 / 美食 / 住宿 / 購物', () => {
    const { getByTestId } = renderPage();
    expect(getByTestId('explore-subtab-all').textContent).toBe('為你推薦');
    expect(getByTestId('explore-subtab-attraction').textContent).toBe('景點');
    expect(getByTestId('explore-subtab-food').textContent).toBe('美食');
    expect(getByTestId('explore-subtab-hotel').textContent).toBe('住宿');
    expect(getByTestId('explore-subtab-shopping').textContent).toBe('購物');
  });

  it('預設 subtab「為你推薦」 套 .is-active', () => {
    const { getByTestId } = renderPage();
    expect(getByTestId('explore-subtab-all').className).toContain('is-active');
    expect(getByTestId('explore-subtab-food').className).not.toContain('is-active');
  });

  it('切 subtab 套 .is-active 並切換 aria-selected', () => {
    const { getByTestId } = renderPage();
    fireEvent.click(getByTestId('explore-subtab-food'));
    expect(getByTestId('explore-subtab-food').className).toContain('is-active');
    expect(getByTestId('explore-subtab-food').getAttribute('aria-selected')).toBe('true');
    expect(getByTestId('explore-subtab-all').className).not.toContain('is-active');
  });

  it('search results 渲染 cover photo (data-tone) + heart save button', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { osm_id: 7, name: '美ら海水族館', address: '沖縄県', lat: 26.69, lng: 127.87, category: 'tourism' },
        ],
      }),
    });
    const { getByTestId, container } = renderPage();
    fireEvent.change(getByTestId('explore-search-input'), { target: { value: '美ら海' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    await waitFor(() => {
      expect(getByTestId('explore-save-btn-7')).toBeTruthy();
    });
    // cover element 含 data-tone (1-8)
    const cover = container.querySelector('.explore-poi-cover');
    expect(cover?.getAttribute('data-tone')).toMatch(/^[1-8]$/);
    // heart button class 含 explore-poi-heart
    const heartBtn = getByTestId('explore-save-btn-7');
    expect(heartBtn.className).toContain('explore-poi-heart');
  });

  it('rating meta line 顯示 ★ icon', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { osm_id: 8, name: '首爾塔', address: '首爾', lat: 37.5, lng: 126.99, category: 'tourism' },
        ],
      }),
    });
    const { getByTestId, container } = renderPage();
    fireEvent.change(getByTestId('explore-search-input'), { target: { value: '首爾' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    await waitFor(() => {
      expect(getByTestId('explore-save-btn-8')).toBeTruthy();
    });
    const rating = container.querySelector('.explore-poi-rating');
    expect(rating?.textContent).toContain('★');
  });

  it('subtab category filter — food 過濾掉非餐廳結果', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { osm_id: 1, name: 'A 餐廳', address: 'X', lat: 1, lng: 1, category: 'restaurant' },
          { osm_id: 2, name: 'B 景點', address: 'X', lat: 1, lng: 1, category: 'tourism' },
        ],
      }),
    });
    const { getByTestId } = renderPage();
    fireEvent.change(getByTestId('explore-search-input'), { target: { value: 'foo' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    await waitFor(() => {
      expect(getByTestId('explore-save-btn-1')).toBeTruthy();
      expect(getByTestId('explore-save-btn-2')).toBeTruthy();
    });
    // 切 food → 只剩 restaurant
    fireEvent.click(getByTestId('explore-subtab-food'));
    expect(() => getByTestId('explore-save-btn-2')).toThrow();
    expect(getByTestId('explore-save-btn-1')).toBeTruthy();
  });
});
