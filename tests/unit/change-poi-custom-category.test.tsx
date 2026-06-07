/**
 * ChangePoiPage 自訂 tab — CategoryPicker 驅動儲存的 poi type（v2.50.0 stale-dep regression）。
 *
 * Bug：customCategory state（v2.50.0 新增）從未被加進 ChangePoiPage 的 `main`
 * useMemo dep array，也沒加進 handleSubmit useCallback dep array。後果：
 *   1. 點分類 tile → setCustomCategory 更新 state，但 memoized `main` 不重算
 *      → CategoryPicker 視覺停在初始 'attraction'（看起來像凍住）。
 *   2. handleSubmit 閉包卡在初始 'attraction' → 自訂景點不論選哪個分類都存成「景點」。
 *
 * 這是 behavioural test：render 真實頁面在 custom tab，依「最自然的填表順序」
 * title → coord → 分類（分類放最後 — 這順序才能重現 handleSubmit 的 stale closure，
 * 因為 handleSubmit 最後一次重建是在改 coord 時、那時分類還是 'attraction'），
 * 然後同時驗證「可見選取」與「送出 payload」都帶到選的分類。
 *
 * 純 source-grep contract test（change-poi-custom-tab.test.ts）抓不到這個 bug：
 * `category={customCategory}` 字串一直都在，壞的是 runtime 行為不是 source pattern。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// 攔截送出 payload
const rawCalls: Array<{ path: string; opts?: RequestInit }> = [];

vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: vi.fn(async (path: string) => {
    if (path.includes('/entries/')) return {}; // entryPoisVersion 探測（master mode）
    if (path.startsWith('/trips/')) return { destinations: [] }; // customDestinations
    if (path === '/poi-favorites') return [];
    return {};
  }),
  apiFetchRaw: vi.fn(async (path: string, opts?: RequestInit) => {
    rawCalls.push({ path, opts });
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 1 }),
      text: async () => '',
    } as Response;
  }),
}));

// Stub 掉 Google-Maps-backed picker map：用一顆按鈕模擬使用者拖地圖選位置（fire onCoordChange）。
vi.mock('../../src/components/trip/LocationPickerMap', () => ({
  LocationPickerMap: ({
    onCoordChange,
  }: {
    onCoordChange: (c: { lat: number; lng: number }) => void;
  }) => (
    <button
      type="button"
      data-testid="mock-pick-coord"
      onClick={() => onCoordChange({ lat: 35.1, lng: 139.1 })}
    >
      pick
    </button>
  ),
}));

// 隔離頁面與 shell chrome（sidebar / bottom-nav 在這裡不該 fetch 任何東西）。
vi.mock('../../src/components/shell/AppShell', () => ({
  default: ({ main }: { main: ReactNode }) => <>{main}</>,
}));

vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', email: 'u@x.com' }, reload: () => {} }),
}));

// custom tab 上 usePoiSearch 是 idle（enabled:false）；stub 讓 test hermetic。
vi.mock('../../src/hooks/usePoiSearch', () => ({
  usePoiSearch: () => ({ results: [], searching: false }),
}));

import ChangePoiPage from '../../src/pages/ChangePoiPage';

function renderCustomTab(entry = '/c/trip123/5?tab=custom') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/c/:tripId/:entryId" element={<ChangePoiPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  rawCalls.length = 0;
});

describe('ChangePoiPage custom tab — CategoryPicker 驅動儲存的 poi type (v2.50.0 stale-dep regression)', () => {
  it('選的分類要同時反映在 picker 與送出的 payload', async () => {
    renderCustomTab();

    // customDestinations（apiFetch '/trips/trip123'）解析後 form 才 mount。
    const restaurantTile = await screen.findByTestId('change-poi-custom-category-restaurant');
    expect(
      screen.getByTestId('change-poi-custom-category-attraction').getAttribute('aria-checked'),
    ).toBe('true');

    // 自然填表順序：title → coord → 分類放最後。
    fireEvent.change(screen.getByTestId('change-poi-custom-title'), {
      target: { value: '心型岩看夕陽' },
    });
    fireEvent.click(screen.getByTestId('mock-pick-coord'));
    fireEvent.click(restaurantTile);

    // (1) 可見選取要反映點的分類（behavioural spec）。注意：jsdom 的 React 19 dev build
    //     會在這次 re-render 順手重算 main（useMemo 是 perf hint 非語意保證），所以這條
    //     在 jsdom 即使沒修也會過 — prod production build cache 較積極才會看到 picker 凍住。
    //     真正 deterministic 的 RED 守門是下面 (2) 的送出 payload（資料寫錯分類）。
    expect(restaurantTile.getAttribute('aria-checked')).toBe('true');
    expect(
      screen.getByTestId('change-poi-custom-category-attraction').getAttribute('aria-checked'),
    ).toBe('false');

    // (2) 送出 payload 必須帶到選的分類（handleSubmit 必須閉包到最新 customCategory，
    //     不是初始 'attraction'）。
    fireEvent.click(screen.getByTestId('change-poi-submit'));

    await waitFor(() => {
      expect(rawCalls.find((c) => c.path.includes('/poi-id'))).toBeTruthy();
    });
    const put = rawCalls.find((c) => c.path.includes('/poi-id'))!;
    const body = JSON.parse(String(put.opts?.body)) as { type?: string; source?: string };
    expect(body.type).toBe('restaurant');
    expect(body.source).toBe('custom');
  });

  it('mode=new 也帶到選的分類（POST /entries 的 poi_type）', async () => {
    // mode=new 走 POST /trips/:id/days/:n/entries，payload 用 snake_case poi_type
    // （非 master 的 type）。同一個 handleSubmit 閉包 → 修前同樣 stale 成 'attraction'。
    // 這也是 /browse QA 實際走的進入點（「新增景點」精靈 → ?mode=new&tab=custom）。
    renderCustomTab('/c/trip123/0?mode=new&day=1&tab=custom');

    const restaurantTile = await screen.findByTestId('change-poi-custom-category-restaurant');
    fireEvent.change(screen.getByTestId('change-poi-custom-title'), {
      target: { value: '某餐廳' },
    });
    fireEvent.click(screen.getByTestId('mock-pick-coord'));
    fireEvent.click(restaurantTile);
    fireEvent.click(screen.getByTestId('change-poi-submit'));

    await waitFor(() => {
      expect(rawCalls.find((c) => c.path.endsWith('/entries'))).toBeTruthy();
    });
    const post = rawCalls.find((c) => c.path.endsWith('/entries'))!;
    const body = JSON.parse(String(post.opts?.body)) as { poi_type?: string; source?: string };
    expect(body.poi_type).toBe('restaurant');
    expect(body.source).toBe('custom');
  });
});
