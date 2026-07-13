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

  it('v2.55.73 動態細類 chip：為你推薦第一 + 由結果 primaryType 生成（含數量、依數量排序）', async () => {
    mockSearch([
      { place_id: 'a', name: '拉麵A', address: 'X', lat: 1, lng: 1, category: 'ramen_restaurant' },
      { place_id: 'b', name: '拉麵B', address: 'X', lat: 1, lng: 1, category: 'ramen_restaurant' },
      { place_id: 'c', name: '咖啡', address: 'X', lat: 1, lng: 1, category: 'cafe' },
      { place_id: 'd', name: '水族館', address: 'X', lat: 1, lng: 1, category: 'aquarium' },
    ]);
    const { getByTestId } = renderPage();
    fireEvent.change(getByTestId('explore-search-input'), { target: { value: '沖繩' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    await waitFor(() => expect(getByTestId('explore-save-btn-a')).toBeTruthy());
    // 為你推薦 永遠第一 + 預設 active
    const all = getByTestId('explore-cat-all');
    expect(all.textContent).toContain('為你推薦');
    expect(all.className).toContain('is-active');
    // 細類由 primaryType 生成：拉麵(2) / 咖啡廳(1) / 水族館(1)
    expect(getByTestId('explore-cat-拉麵').textContent).toContain('拉麵');
    expect(getByTestId('explore-cat-拉麵').textContent).toContain('2'); // count badge
    expect(getByTestId('explore-cat-咖啡廳')).toBeTruthy();
    expect(getByTestId('explore-cat-水族館')).toBeTruthy();
  });

  it('無結果時只有「為你推薦」chip 且 active', () => {
    const { getByTestId } = renderPage(); // beforeEach mockSearch([]) → 空結果
    expect(getByTestId('explore-cat-all').className).toContain('is-active');
  });

  it('v2.55.73 細類 > 4 種 → 前 4 inline、其餘收進「更多」選單、點選單項可篩選', async () => {
    mockSearch([
      { place_id: '1', name: 'A', address: 'X', lat: 1, lng: 1, category: 'ramen_restaurant' },
      { place_id: '2', name: 'B', address: 'X', lat: 1, lng: 1, category: 'cafe' },
      { place_id: '3', name: 'C', address: 'X', lat: 1, lng: 1, category: 'aquarium' },
      { place_id: '4', name: 'D', address: 'X', lat: 1, lng: 1, category: 'art_gallery' },
      { place_id: '5', name: 'E', address: 'X', lat: 1, lng: 1, category: 'department_store' },
      { place_id: '6', name: 'F', address: 'X', lat: 1, lng: 1, category: 'shinto_shrine' },
    ]);
    const { getByTestId } = renderPage();
    fireEvent.change(getByTestId('explore-search-input'), { target: { value: 'many' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    await waitFor(() => expect(getByTestId('explore-save-btn-1')).toBeTruthy());
    // 6 種細類（count 皆 1，穩定排序＝插入序）→ 前 4 inline、後 2 進「更多」
    expect(getByTestId('explore-cat-more').textContent).toContain('更多');
    // details 保留 children 於 DOM → 選單項可直接點，點後只留該類
    fireEvent.click(getByTestId('explore-cat-menu-神社'));
    expect(getByTestId('explore-save-btn-6')).toBeTruthy(); // shinto_shrine → 神社
    expect(() => getByTestId('explore-save-btn-1')).toThrow(); // 拉麵 被濾掉
  });

  it('v2.55.73 結果卡片 poi-category 顯示細類 label（拉麵 而非粗類 餐廳）', async () => {
    mockSearch([
      { place_id: 'x', name: '豚人拉麵', address: 'X', lat: 1, lng: 1, category: 'ramen_restaurant' },
    ]);
    const { getByTestId, container } = renderPage();
    fireEvent.change(getByTestId('explore-search-input'), { target: { value: 'ramen' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    await waitFor(() => expect(getByTestId('explore-save-btn-x')).toBeTruthy());
    expect(container.querySelector('.poi-category')?.textContent).toBe('拉麵');
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

  it('v2.55.73 點細類 chip → 只留該類結果、chip 套 is-active + aria-selected', async () => {
    mockSearch([
      { place_id: 'p1', name: '拉麵店', address: 'X', lat: 1, lng: 1, category: 'ramen_restaurant' },
      { place_id: 'p2', name: '水族館', address: 'X', lat: 1, lng: 1, category: 'aquarium' },
    ]);
    const { getByTestId } = renderPage();
    fireEvent.change(getByTestId('explore-search-input'), { target: { value: 'foo' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    await waitFor(() => {
      expect(getByTestId('explore-save-btn-p1')).toBeTruthy();
      expect(getByTestId('explore-save-btn-p2')).toBeTruthy();
    });
    // 點「拉麵」細類 → 只剩 ramen_restaurant
    fireEvent.click(getByTestId('explore-cat-拉麵'));
    expect(getByTestId('explore-cat-拉麵').className).toContain('is-active');
    expect(getByTestId('explore-cat-拉麵').getAttribute('aria-selected')).toBe('true');
    expect(getByTestId('explore-cat-all').className).not.toContain('is-active');
    expect(() => getByTestId('explore-save-btn-p2')).toThrow();
    expect(getByTestId('explore-save-btn-p1')).toBeTruthy();
  });

  it('v2.55.73 新搜尋重置 filter — 細類消失再出現不靜默復活舊選擇（隱藏結果回歸）', async () => {
    // 搜尋1（有拉麵）→ 選拉麵
    mockSearch([
      { place_id: 'r1', name: '拉麵1', address: 'X', lat: 1, lng: 1, category: 'ramen_restaurant' },
      { place_id: 'a1', name: '水族館1', address: 'X', lat: 1, lng: 1, category: 'aquarium' },
    ]);
    const { getByTestId } = renderPage();
    fireEvent.change(getByTestId('explore-search-input'), { target: { value: '沖繩' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    await waitFor(() => expect(getByTestId('explore-save-btn-r1')).toBeTruthy());
    fireEvent.click(getByTestId('explore-cat-拉麵')); // category='拉麵'
    // 搜尋2（無拉麵）→ activeCategory 遮成 all
    mockSearch([{ place_id: 'c2', name: '咖啡2', address: 'X', lat: 1, lng: 1, category: 'cafe' }]);
    fireEvent.change(getByTestId('explore-search-input'), { target: { value: '東京' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    await waitFor(() => expect(getByTestId('explore-save-btn-c2')).toBeTruthy());
    // 搜尋3（拉麵又出現＋水族館）→ 沒重置的話 category='拉麵' snap 回、隱藏水族館3
    mockSearch([
      { place_id: 'r3', name: '拉麵3', address: 'X', lat: 1, lng: 1, category: 'ramen_restaurant' },
      { place_id: 'a3', name: '水族館3', address: 'X', lat: 1, lng: 1, category: 'aquarium' },
    ]);
    fireEvent.change(getByTestId('explore-search-input'), { target: { value: '大阪' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    await waitFor(() => expect(getByTestId('explore-save-btn-r3')).toBeTruthy());
    // 修正後：filter 已重置 → 為你推薦 active + 水族館3 未被復活的「拉麵」filter 隱藏
    expect(getByTestId('explore-cat-all').className).toContain('is-active');
    expect(getByTestId('explore-save-btn-a3')).toBeTruthy();
  });
});
