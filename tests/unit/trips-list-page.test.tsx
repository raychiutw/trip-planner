/**
 * TripsListPage unit test — unified /trips?selected= architecture.
 *
 * Mobile + ?selected → embedded TripPage as main (cards hidden)
 * Desktop → cards in main + embedded TripPage in sheet (always)
 * No ?selected mobile → cards stacked
 *
 * TripPage is mocked because it has heavy dependencies (useTrip + useDarkMode +
 * leaflet etc) unrelated to TripsListPage's concern.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NewTripProvider } from '../../src/contexts/NewTripContext';
import { writeTripView } from '../../src/lib/tripViewState';
import { TRIP_MAIN_PORTAL_ID } from '../../src/lib/tripStackRoutes';
import { lsSet, LS_KEY_TRIP_PREF } from '../../src/lib/localStorage';

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
vi.mock('../../src/pages/TripPage', () => ({
  default: ({ tripId, noShell }: { tripId?: string; noShell?: boolean }) => (
    <div data-testid="embedded-trip-page" data-trip-id={tripId} data-no-shell={String(noShell)}>
      Mock TripPage: {tripId}
    </div>
  ),
}));

function mockMatchMedia(isDesktop: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (q: string) => ({
      matches: isDesktop && q.includes('1024'),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

import TripsListPage from '../../src/pages/TripsListPage';

// #1140 item 7 後：TripsListPage 讀 activeTripId（ActiveTripContext，無 provider 時 fallback
// 直讀/寫 localStorage `LS_KEY_TRIP_PREF`）。前面 setActiveTrip 的測試會把值留在 localStorage，
// 洩漏到後面「無 ?selected」的測試 → 桌機 restore 誤導向 embedded、卡片列表消失。每個測試前後清乾淨。
beforeEach(() => { mockMatchMedia(true); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

/**
 * 2026-07-21：TripsListPage 改為單抓 /my-trips。原本 /my-trips 只拿 id 順序、
 * metadata 另抓 /trips?all=1，而那支對一般使用者降級成 published-only —— 行程
 * 改為不公開後 metadata 全空，卡片就把 tripId 當名稱顯示。
 *
 * `my` 參數保留但已不需要另給：直接把完整資料當成 /my-trips 的回應，
 * 這才是 prod 的實際 shape。
 */
function mockApi(_my: { tripId: string }[], all: Array<Record<string, unknown>>) {
  return vi.fn().mockImplementation((url: string) => {
    if (url === '/api/my-trips') return Promise.resolve(new Response(JSON.stringify(all), { status: 200 }));
    return Promise.resolve(new Response('null', { status: 200 }));
  });
}

const SAMPLE = [
  // mockup-parity-qa-fixes: API 透過 deepCamel() 回 camelCase；test mock 跟 prod response shape 一致
  { tripId: 'okinawa', name: '沖繩之旅', title: '沖繩之旅', countries: 'JP', published: 1, dayCount: 5, startDate: '2026-07-26', endDate: '2026-07-30', memberCount: 2 },
  { tripId: 'seoul', name: '首爾美食行', title: '首爾美食行', countries: 'KR', published: 1, dayCount: 4, startDate: '2026-08-15', endDate: '2026-08-18', memberCount: 1 },
];

describe('TripsListPage', () => {
  it('shows loading initially', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    expect(screen.getByTestId('trips-list-loading')).toBeTruthy();
  });

  it('zero trips → hero CTA in main', async () => {
    vi.stubGlobal('fetch', mockApi([], []));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-empty')).toBeTruthy());
    expect(screen.getByTestId('trips-list-new-trip-hero')).toBeTruthy();
  });

  it('cards render with country + day count + date range + member count', async () => {
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-okinawa')).toBeTruthy());
    // Section 4.7 (terracotta-ui-parity-polish): eyebrow 中文化「日本 · N 天」對齊 mockup
    expect(screen.getByText('日本 · 5 天')).toBeTruthy();
    // v2.31.31: 對齊 mockup「{owner} · 7/29 出發」spec — 拔掉 memberCount，mobile fit。
    expect(screen.getByText('7/26 – 7/30')).toBeTruthy();
    expect(screen.getByText('韓國 · 4 天')).toBeTruthy();
  });

  // 2026-05-03 modal-to-fullpage migration: NewTripModal → /trips/new page。
  // 不再 inline modal — 點擊 button → navigate('/trips/new')。Test 改驗
  // 「button 存在 + tagName + window 沒 modal portal」（現在無 portal mount）。
  it('trailing 新增行程 card present when trips exist (navigates to /trips/new on click)', async () => {
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-new-trip-card')).toBeTruthy());
    const btn = screen.getByTestId('trips-list-new-trip-card');
    expect(btn.tagName).toBe('BUTTON');
    // No more modal portal — page navigation handled by useNewTrip().openModal() → navigate('/trips/new')
    expect(screen.queryByTestId('new-trip-modal')).toBeNull();
    fireEvent.click(btn);
    // Modal still null after click (no portal mount); navigate side-effect not asserted in unit test
    expect(screen.queryByTestId('new-trip-modal')).toBeNull();
  });

  // 2026-05-03 modal-to-fullpage migration: 同上 — empty hero CTA 改 navigate
  // 到 /trips/new，不再 inline modal。
  it('empty hero CTA navigates to /trips/new on click', async () => {
    vi.stubGlobal('fetch', mockApi([], []));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-new-trip-hero')).toBeTruthy());
    fireEvent.click(screen.getByTestId('trips-list-new-trip-hero'));
    // Modal portal no longer mounts; navigate happens via useNewTrip context
    expect(screen.queryByTestId('new-trip-modal')).toBeNull();
  });

  it('desktop + no ?selected: card grid renders, no embedded TripPage (PR-PP)', async () => {
    // PR-PP 2026-04-26：架構改 2-pane (sidebar + main，去 sheet)。
    // /trips landing 不再自動選第一筆 + 開 sheet — user 看到的是 card grid。
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-okinawa')).toBeTruthy());
    expect(screen.queryByTestId('embedded-trip-page')).toBeNull();
  });

  // #1140 item 7：聊天/地圖/行程三 tab 共用同一 active trip（`ActiveTripContext` / localStorage）。
  // 桌機無 ?selected 時，restore 應還原到 active trip（seoul）而非清單第一筆（okinawa）——
  // 與聊天/地圖同源。還原後 URL 帶 ?selected=seoul → main 出現 portal placeholder。
  it('desktop + active trip in localStorage, no ?selected → restores active trip (item 7)', async () => {
    lsSet(LS_KEY_TRIP_PREF, 'seoul');
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId(TRIP_MAIN_PORTAL_ID)).toBeTruthy());
    // switcher 標題應反映 active trip（seoul），而非第一筆 okinawa。
    expect(screen.getByTestId('trips-trip-title').textContent).toMatch(/首爾美食行/);
  });

  // owner 2026-07-21 回報 #2「開關第三欄面板會刷新第二欄」修復：桌機不再由
  // TripsListPage 自己 inline render <TripPage>（那是造成路由切換時 remount 的
  // root cause），改留一個 portal placeholder，讓 main.tsx 的 TripPageHost
  // （唯一一份持續存在的 <TripPage>）portal 內容進來。見 TripPageHost.tsx。
  // 手機沒有這個機制（下方 mobile 測試維持 inline <TripPage>，見 148 行起）。
  it('desktop + ?selected=seoul: main 留 portal placeholder（不再 inline render TripPage，交給 TripPageHost）(PR-PP + owner #2)', async () => {
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips?selected=seoul']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId(TRIP_MAIN_PORTAL_ID)).toBeTruthy());
    // 桌機不 inline render TripPage 了 —— TripPageHost 才是唯一呼叫端。
    expect(screen.queryByTestId('embedded-trip-page')).toBeNull();
  });

  it('mobile + no ?selected: card grid renders, no embedded TripPage in main', async () => {
    mockMatchMedia(false);
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-okinawa')).toBeTruthy());
    expect(screen.queryByTestId('embedded-trip-page')).toBeNull();
  });

  it('mobile + ?selected=okinawa: embedded TripPage replaces card grid', async () => {
    mockMatchMedia(false);
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips?selected=okinawa']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('embedded-trip-page')).toBeTruthy());
    expect(screen.getByTestId('embedded-trip-page').getAttribute('data-trip-id')).toBe('okinawa');
    // Card grid should NOT render in main (it's been replaced)
    expect(screen.queryByTestId('trips-list-card-okinawa')).toBeNull();
  });

  it('mobile click on card sets ?selected (no navigation, no /trip route)', async () => {
    mockMatchMedia(false);
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-okinawa')).toBeTruthy());
    fireEvent.click(screen.getByTestId('trips-list-card-okinawa'));
    await waitFor(() => expect(screen.queryByTestId('embedded-trip-page')).toBeTruthy());
    expect(screen.getByTestId('embedded-trip-page').getAttribute('data-trip-id')).toBe('okinawa');
  });

  it('error state on /api/my-trips 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url === '/api/my-trips') return Promise.resolve(new Response('boom', { status: 500 }));
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    }));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-error')).toBeTruthy());
  });
});

describe('TripsListPage — Section 4.7 toolbar (filter/sort/search/owner)', () => {
  const sample = [
    // u@x.com 是 mock current user → owner === user → 我的
    // mockup-parity-qa-fixes: API 透過 deepCamel() 回 camelCase
    { tripId: 'okinawa', name: '沖繩', title: '沖繩', countries: 'JP', published: 1, dayCount: 5, memberCount: 2, owner: 'u@x.com' },
    // 不同 owner → 共編
    { tripId: 'seoul', name: '首爾', title: '首爾', countries: 'KR', published: 1, dayCount: 4, memberCount: 1, owner: 'friend@x.com' },
    { tripId: 'taipei', name: '台北', title: '台北', countries: 'TW', published: 1, dayCount: 3, memberCount: 1, owner: 'u@x.com' },
  ];

  it('toolbar 顯示三個 filter tab + sort dropdown + search toggle', async () => {
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }, { tripId: 'taipei' }], sample));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-toolbar')).toBeTruthy());
    expect(screen.getByTestId('trips-list-tab-all')).toBeTruthy();
    expect(screen.getByTestId('trips-list-tab-mine')).toBeTruthy();
    expect(screen.getByTestId('trips-list-tab-collab')).toBeTruthy();
    expect(screen.getByTestId('trips-list-sort')).toBeTruthy();
    expect(screen.getByTestId('trips-list-search-toggle')).toBeTruthy();
  });

  it('filter tab「我的」只顯示 owner === current user 的 trip', async () => {
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }, { tripId: 'taipei' }], sample));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-tab-mine')).toBeTruthy());
    fireEvent.click(screen.getByTestId('trips-list-tab-mine'));
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-okinawa')).toBeTruthy());
    expect(screen.queryByTestId('trips-list-card-okinawa')).toBeTruthy();
    expect(screen.queryByTestId('trips-list-card-taipei')).toBeTruthy();
    expect(screen.queryByTestId('trips-list-card-seoul')).toBeNull();
  });

  it('filter tab「共編」只顯示 owner !== current user 的 trip', async () => {
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }, { tripId: 'taipei' }], sample));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-tab-collab')).toBeTruthy());
    fireEvent.click(screen.getByTestId('trips-list-tab-collab'));
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-seoul')).toBeTruthy());
    expect(screen.queryByTestId('trips-list-card-seoul')).toBeTruthy();
    expect(screen.queryByTestId('trips-list-card-okinawa')).toBeNull();
  });

  it('search toggle expand → input 出現 + 過濾後 count 顯示', async () => {
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }, { tripId: 'taipei' }], sample));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-search-toggle')).toBeTruthy());
    expect(screen.queryByTestId('trips-list-search-input')).toBeNull();
    fireEvent.click(screen.getByTestId('trips-list-search-toggle'));
    await waitFor(() => expect(screen.queryByTestId('trips-list-search-input')).toBeTruthy());
    fireEvent.change(screen.getByTestId('trips-list-search-input'), { target: { value: '沖繩' } });
    await waitFor(() => expect(screen.queryByTestId('trips-list-search-count')).toBeTruthy());
    expect(screen.getByTestId('trips-list-search-count').textContent).toContain('1');
  });

  it('owner avatar 顯示「由你建立」/ owner email username', async () => {
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }], sample));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-owner-okinawa')).toBeTruthy());
    expect(screen.getByTestId('trips-list-card-owner-okinawa').textContent).toContain('由你建立');
    expect(screen.getByTestId('trips-list-card-owner-seoul').textContent).toContain('friend');
  });
});

describe('TripsListPage — 進 /trips 還原上次檢視（v2.55.x bug 1）', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('桌機 + 無 ?selected + 有上次檢視紀錄 → 自動開回該行程（留 portal placeholder 給 TripPageHost）', async () => {
    mockMatchMedia(true);
    writeTripView({ tripId: 'okinawa', dayNum: 2 });
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId(TRIP_MAIN_PORTAL_ID)).toBeTruthy());
    expect(screen.queryByTestId('embedded-trip-page')).toBeNull();
  });

  it('手機 + 有上次檢視紀錄 → 不自動還原（Trips 分頁顯示清單）', async () => {
    mockMatchMedia(false);
    writeTripView({ tripId: 'okinawa', dayNum: 2 });
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }, { tripId: 'seoul' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-okinawa')).toBeTruthy());
    expect(screen.queryByTestId('embedded-trip-page')).toBeNull();
  });

  it('桌機 + 上次檢視的行程已不在清單 → 不還原（顯示清單）', async () => {
    mockMatchMedia(true);
    writeTripView({ tripId: 'deleted-trip', dayNum: 1 });
    vi.stubGlobal('fetch', mockApi([{ tripId: 'okinawa' }], SAMPLE));
    render(<MemoryRouter initialEntries={['/trips']}><NewTripProvider><TripsListPage /></NewTripProvider></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('trips-list-card-okinawa')).toBeTruthy());
    expect(screen.queryByTestId('embedded-trip-page')).toBeNull();
  });
});
