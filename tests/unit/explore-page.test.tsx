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

/** Helper：mock /poi-search response on apiFetchMock (auto-search at mount fires once). */
type SearchResult = { place_id: string; name: string; address: string; lat: number; lng: number; category: string };
function mockSearch(results: SearchResult[] = []): void {
  apiFetchMock.mockImplementation((path: string) => {
    if (path === '/poi-favorites') return Promise.resolve([]);
    if (path.startsWith('/poi-search')) return Promise.resolve({ results });
    if (path === '/pois/find-or-create') return Promise.resolve({ id: 42 });
    return Promise.resolve({});
  });
}

describe('ExplorePage', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    mockSearch([]);
    global.fetch = vi.fn();
  });

  it('renders search input (TitleBar 收藏 action 已於 v2.33.140 拔除 — back ← 已回 /favorites 重複入口)', () => {
    const { getByTestId, queryByTestId } = renderPage();
    expect(getByTestId('explore-page')).toBeTruthy();
    expect(getByTestId('explore-search-input')).toBeTruthy();
    // v2.33.140 regression — 收藏 action 不應再 render
    expect(queryByTestId('explore-favorites-titlebar')).toBeNull();
  });

  it('shows error toast when search query < 2 chars', () => {
    /* 2026-04-29 (E5):mount 後 auto runSearch with default region seed
     * → apiFetch /poi-search 已被 call 一次。Test 改驗 user input < 2 字 click submit
     * 不會 trigger 第二次 search call。 */
    mockSearch([]);
    const { getByTestId } = renderPage();
    const initialSearchCalls = apiFetchMock.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].startsWith('/poi-search'),
    ).length;
    const input = getByTestId('explore-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    const afterSearchCalls = apiFetchMock.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].startsWith('/poi-search'),
    ).length;
    expect(afterSearchCalls).toBe(initialSearchCalls);
  });

  it('calls /poi-search on valid submit + renders results', async () => {
    mockSearch([
      { place_id: 'p1', name: '沖繩水族館', address: 'Japan', lat: 26.6941, lng: 127.8778, category: 'tourism' },
    ]);
    const { getByTestId, findByText } = renderPage();
    const input = getByTestId('explore-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '沖繩' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    expect(await findByText('沖繩水族館')).toBeTruthy();
    expect(apiFetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/poi-search?q='),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('save button triggers find-or-create + poi-favorites POST', async () => {
    mockSearch([
      { place_id: 'p99', name: 'Test POI', address: 'Addr', lat: 25, lng: 121, category: 'food' },
    ]);

    const { getByTestId, findByTestId } = renderPage();
    const input = getByTestId('explore-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.click(getByTestId('explore-search-submit'));

    const saveBtn = await findByTestId('explore-save-btn-p99');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/pois/find-or-create',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/poi-favorites',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});

describe('ExplorePage — Section 4.9 card cover + region + subtabs', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    mockSearch([]);
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

  it('search results 渲染 cover（依 POI 類型三色 tone）+ heart save button', async () => {
    mockSearch([
      { place_id: 'p7', name: '美ら海水族館', address: '沖縄県', lat: 26.69, lng: 127.87, category: 'tourism' },
    ]);
    const { getByTestId, container } = renderPage();
    fireEvent.change(getByTestId('explore-search-input'), { target: { value: '美ら海' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    await waitFor(() => {
      expect(getByTestId('explore-save-btn-p7')).toBeTruthy();
    });
    // v2.54.11: cover 漸層改依卡的三色 tone（取代舊 8 色 hash 裝飾）。tone 在 card 上、
    // cover 經 CSS（.explore-poi-card[data-tone] .explore-poi-cover）繼承，cover 本身不再帶 data-tone。
    const card = container.querySelector('.explore-poi-card');
    expect(card?.getAttribute('data-tone')).toMatch(/^(accent|sage|pink|neutral)$/);
    const cover = container.querySelector('.explore-poi-cover');
    expect(cover?.getAttribute('data-tone')).toBeNull();
    // heart button class 含 explore-poi-heart
    const heartBtn = getByTestId('explore-save-btn-p7');
    expect(heartBtn.className).toContain('explore-poi-heart');
    // v2.54.11 review F1：收藏/加入行程鈕不得巢在 aria-hidden 的裝飾 cover 內，
    // 否則整組互動鈕被移出無障礙樹。按鈕應為 card 直屬。
    expect(cover?.querySelector('button')).toBeNull();
    expect(heartBtn.closest('.explore-poi-cover')).toBeNull();
    expect(heartBtn.closest('.explore-poi-card')).not.toBeNull();
  });

  it('卡 data-tone 依 POI 類型映射（restaurant→粉 / museum→柔褐 / hotel→sage）', async () => {
    // v2.54.11 review F3：行為證明 category → tone 綁定（非僅「四色之一」）。
    mockSearch([
      { place_id: 'r1', name: '拉麵店', address: 'X', lat: 1, lng: 1, category: 'restaurant' },
      { place_id: 'm1', name: '博物館', address: 'X', lat: 1, lng: 1, category: 'museum' },
      { place_id: 'h1', name: '飯店', address: 'X', lat: 1, lng: 1, category: 'hotel' },
    ]);
    const { getByTestId, container } = renderPage();
    fireEvent.change(getByTestId('explore-search-input'), { target: { value: 'mix' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    await waitFor(() => {
      expect(getByTestId('explore-save-btn-r1')).toBeTruthy();
    });
    const cards = Array.from(container.querySelectorAll('.explore-poi-card'));
    const toneByName = (n: string) =>
      cards.find((c) => c.querySelector('.poi-name')?.textContent === n)?.getAttribute('data-tone');
    expect(toneByName('拉麵店')).toBe('pink'); // restaurant → 吃 → 粉
    expect(toneByName('博物館')).toBe('accent'); // museum → 景點 → 柔褐
    expect(toneByName('飯店')).toBe('sage'); // hotel → 住 → sage
  });

  it('rating meta line 顯示 ★ icon', async () => {
    // v2.34.38 prod audit fix: 有 rating 才顯示 ★。
    // mock 加 rating field 確保 .explore-poi-rating 真的 render。
    mockSearch([
      { place_id: 'p8', name: '首爾塔', address: '首爾', lat: 37.5, lng: 126.99, category: 'tourism', rating: 4.6 },
    ]);
    const { getByTestId, container } = renderPage();
    fireEvent.change(getByTestId('explore-search-input'), { target: { value: '首爾' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    await waitFor(() => {
      expect(getByTestId('explore-save-btn-p8')).toBeTruthy();
    });
    const rating = container.querySelector('.explore-poi-rating');
    expect(rating).not.toBeNull();
    expect(rating?.textContent).toContain('★');
    expect(rating?.textContent).toContain('4.6');
  });

  it('v2.34.38 prod audit fix: 無 rating → 不 render ★（不再顯示「探索更多評論」placeholder）', async () => {
    mockSearch([
      { place_id: 'p9', name: '無評論景點', address: '某地', lat: 0, lng: 0, category: 'tourism' },
    ]);
    const { getByTestId, container } = renderPage();
    fireEvent.change(getByTestId('explore-search-input'), { target: { value: '無評論景點' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    await waitFor(() => {
      expect(getByTestId('explore-save-btn-p9')).toBeTruthy();
    });
    expect(container.querySelector('.explore-poi-rating')).toBeNull();
    expect(container.textContent).not.toContain('探索更多評論');
  });

  it('subtab category filter — food 過濾掉非餐廳結果', async () => {
    mockSearch([
      { place_id: 'p1', name: 'A 餐廳', address: 'X', lat: 1, lng: 1, category: 'restaurant' },
      { place_id: 'p2', name: 'B 景點', address: 'X', lat: 1, lng: 1, category: 'tourism' },
    ]);
    const { getByTestId } = renderPage();
    fireEvent.change(getByTestId('explore-search-input'), { target: { value: 'foo' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    await waitFor(() => {
      expect(getByTestId('explore-save-btn-p1')).toBeTruthy();
      expect(getByTestId('explore-save-btn-p2')).toBeTruthy();
    });
    // 切 food → 只剩 restaurant
    fireEvent.click(getByTestId('explore-subtab-food'));
    expect(() => getByTestId('explore-save-btn-p2')).toThrow();
    expect(getByTestId('explore-save-btn-p1')).toBeTruthy();
  });
});
