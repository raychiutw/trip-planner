import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import AddStopPage from '../../src/pages/AddStopPage';
import ChangePoiPage from '../../src/pages/ChangePoiPage';
import { getToasts, resetToasts } from '../../src/lib/toastBus';

const { apiFetch, apiFetchRaw } = vi.hoisted(() => ({
  apiFetch: vi.fn<(path: string) => Promise<unknown>>(),
  apiFetchRaw: vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(),
}));
vi.mock('../../src/lib/apiClient', () => ({ apiFetch, apiFetchRaw }));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', email: 'test@example.com' }, loading: false }),
}));
vi.mock('../../src/hooks/useNavigateBack', () => ({ useNavigateBack: () => vi.fn() }));
vi.mock('../../src/components/shell/AppShell', () => ({
  default: ({ main }: { main: React.ReactNode }) => <>{main}</>,
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

const searchRow = { place_id: 'place-1', name: '東京塔', lat: 35.65, lng: 139.75, category: 'attraction' };
const favorite = { id: 9, poiId: 321, poiName: '收藏景點', poiLat: 35.6, poiLng: 139.7, poiType: 'attraction' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

function mount(path: string) {
  function ChangeRoute() {
    const navigate = useNavigate();
    return <>
      <button type="button" onClick={() => navigate('/trip/t1/stop/42/change-poi?mode=master')}>切換正選意圖</button>
      <ChangePoiPage />
    </>;
  }
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/trip/:tripId/add-stop" element={<AddStopPage />} />
        <Route path="/trip/:tripId/stop/:entryId/change-poi" element={<ChangeRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  resetToasts();
  apiFetch.mockImplementation(async (path) => path.endsWith('/days') ? [{ id: 1, dayNum: 1 }] : []);
  apiFetchRaw.mockImplementation(async (path) => path.startsWith('/poi-search')
    ? json({ results: [searchRow] })
    : path.includes('/recompute-travel') ? json({}) : json({ id: 11 }, 201));
});

describe('POI selection page source states', () => {
  it.each([
    ['/trip/t1/add-stop?day=1&tab=favorites', 'add-stop'],
    ['/trip/t1/stop/42/change-poi?mode=alternate&tab=favorites', 'change-poi'],
  ])('%s shows favorite failure and recovers on retry', async (path, prefix) => {
    apiFetch.mockImplementation(async (url) => {
      if (url === '/poi-favorites') throw new Error('offline');
      return url.endsWith('/days') ? [{ id: 1, dayNum: 1 }] : [];
    });
    mount(path);
    expect(await screen.findByRole('alert', { name: '載入收藏失敗' })).toBeTruthy();
    expect(screen.queryByText('還沒收藏景點')).toBeNull();
    apiFetch.mockImplementation(async (url) => url === '/poi-favorites' ? [favorite] : []);
    fireEvent.click(screen.getByRole('button', { name: '重試載入收藏' }));
    expect(await screen.findByTestId(`${prefix}-${prefix === 'add-stop' ? 'favorites-card' : 'favorite-item'}-9`)).toBeTruthy();
  });

  it.each([
    ['/trip/t1/add-stop?day=1', 'add-stop'],
    ['/trip/t1/stop/42/change-poi?mode=alternate', 'change-poi'],
  ])('%s reports idle, loading, empty and ready search states', async (path, prefix) => {
    let finish!: (response: Response) => void;
    apiFetchRaw.mockImplementation(async (url) => url.startsWith('/poi-search')
      ? new Promise<Response>((resolve) => { finish = resolve; })
      : json({}));
    mount(path);
    expect(screen.getByText(/輸入關鍵字搜尋/)).toBeTruthy();
    fireEvent.input(screen.getByTestId(`${prefix}-search-input`), { target: { value: '東京' } });
    expect(screen.getByRole('status')).toHaveTextContent('搜尋中');
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    finish(json({ results: [] }));
    expect(await screen.findByText('沒有找到結果，換個關鍵字試試')).toBeTruthy();
    apiFetchRaw.mockImplementation(async (url) => url.startsWith('/poi-search')
      ? json({ results: [searchRow] })
      : json({}));
    fireEvent.input(screen.getByTestId(`${prefix}-search-input`), { target: { value: '東京塔' } });
    expect(await screen.findByTestId(`${prefix}-${prefix === 'add-stop' ? 'search-card' : 'search-item'}-place-1`)).toBeTruthy();
  });

  it.each([
    ['/trip/t1/add-stop?day=1', 'add-stop'],
    ['/trip/t1/stop/42/change-poi?mode=alternate', 'change-poi'],
  ])('%s distinguishes search failure from empty and retries', async (path, prefix) => {
    apiFetchRaw.mockImplementation(async (url) => url.startsWith('/poi-search')
      ? json({}, 503)
      : json({ id: 11 }, 201));
    mount(path);
    fireEvent.input(screen.getByTestId(`${prefix}-search-input`), { target: { value: '東京' } });
    expect(await screen.findByRole('alert', { name: '搜尋失敗' })).toBeTruthy();
    expect(screen.queryByText('沒有找到結果，換個關鍵字試試')).toBeNull();
    apiFetchRaw.mockImplementation(async (url) => url.startsWith('/poi-search')
      ? json({ results: [searchRow] })
      : json({ id: 11 }, 201));
    fireEvent.click(screen.getByRole('button', { name: '重新搜尋' }));
    expect(await screen.findByTestId(`${prefix}-${prefix === 'add-stop' ? 'search-card' : 'search-item'}-place-1`)).toBeTruthy();
  });

  it('AddStop clears multi-selection when the source or search query changes', async () => {
    apiFetch.mockImplementation(async (url) => url === '/poi-favorites' ? [favorite] : []);
    mount('/trip/t1/add-stop?day=1');
    expect(screen.getByTestId('add-stop-confirm')).toHaveTextContent('加入景點');
    fireEvent.input(screen.getByTestId('add-stop-search-input'), { target: { value: '東京' } });
    const card = await screen.findByTestId('add-stop-search-card-place-1');
    fireEvent.click(card);
    expect(screen.getByTestId('add-stop-counter')).toHaveTextContent('已選 1 個');
    fireEvent.click(screen.getByTestId('add-stop-tab-favorites'));
    expect(screen.getByTestId('add-stop-counter')).toHaveTextContent('已選 0 個');
    fireEvent.click(screen.getByTestId('add-stop-tab-search'));
    expect(screen.getByTestId('add-stop-counter')).toHaveTextContent('已選 0 個');
    fireEvent.click(await screen.findByTestId('add-stop-search-card-place-1'));
    fireEvent.input(screen.getByTestId('add-stop-search-input'), { target: { value: '京都' } });
    expect(screen.getByTestId('add-stop-counter')).toHaveTextContent('已選 0 個');
    expect(screen.getByTestId('add-stop-confirm')).toBeDisabled();
  });

  it('AddStop retries only failed writes after partial success', async () => {
    const second = { ...searchRow, place_id: 'place-2', name: '淺草寺' };
    let writes = 0;
    apiFetchRaw.mockImplementation(async (url) => {
      if (url.startsWith('/poi-search')) return json({ results: [searchRow, second] });
      if (url.includes('/recompute-travel')) return json({});
      writes += 1;
      return json(writes === 2 ? { error: { message: 'busy' } } : { id: writes }, writes === 2 ? 503 : 201);
    });
    mount('/trip/t1/add-stop?day=1');
    fireEvent.input(screen.getByTestId('add-stop-search-input'), { target: { value: '東京' } });
    fireEvent.click(await screen.findByTestId('add-stop-search-card-place-1'));
    fireEvent.click(screen.getByTestId('add-stop-search-card-place-2'));
    fireEvent.click(screen.getByTestId('add-stop-confirm'));
    expect(await screen.findByText(/1\/2 個項目儲存失敗/)).toBeTruthy();
    expect(screen.getByTestId('add-stop-counter')).toHaveTextContent('已選 1 個');
    fireEvent.click(screen.getByTestId('add-stop-confirm'));
    await waitFor(() => expect(writes).toBe(3));
  });

  it('ChangePoi clears a chosen alternate when operation changes to replace master', async () => {
    mount('/trip/t1/stop/42/change-poi?mode=alternate');
    fireEvent.input(screen.getByTestId('change-poi-search-input'), { target: { value: '東京' } });
    fireEvent.click(await screen.findByTestId('change-poi-search-item-place-1'));
    expect(screen.getByTestId('change-poi-submit')).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '切換正選意圖' }));
    expect(screen.getByTestId('change-poi-submit')).toHaveTextContent('置換景點');
    expect(screen.getByTestId('change-poi-submit')).toBeDisabled();
    fireEvent.click(await screen.findByTestId('change-poi-search-item-place-1'));
    fireEvent.click(screen.getByTestId('change-poi-submit'));
    await waitFor(() => expect(apiFetchRaw.mock.calls.some(([url, init]) => url.endsWith('/poi-id') && init?.method === 'PUT')).toBe(true));
    expect(apiFetchRaw.mock.calls.some(([url]) => url.endsWith('/alternates'))).toBe(false);
  });

  it('ChangePoi keeps a 409 conflict visible and does not claim success', async () => {
    apiFetchRaw.mockImplementation(async (url) => url.startsWith('/poi-search')
      ? json({ results: [searchRow] })
      : url.includes('/recompute-travel') ? json({}) : json({ error: { code: 'DUPLICATE_POI', message: 'duplicate' } }, 409));
    mount('/trip/t1/stop/42/change-poi?mode=alternate');
    fireEvent.input(screen.getByTestId('change-poi-search-input'), { target: { value: '東京' } });
    fireEvent.click(await screen.findByTestId('change-poi-search-item-place-1'));
    fireEvent.click(screen.getByTestId('change-poi-submit'));
    expect(await screen.findByText('此景點已存在於這個停留點')).toBeTruthy();
    expect(screen.getByTestId('change-poi-submit')).toBeEnabled();
  });

  it('ChangePoi creates a new entry when the page declares new-entry intent', async () => {
    mount('/trip/t1/stop/0/change-poi?mode=new&day=1');
    fireEvent.input(screen.getByTestId('change-poi-search-input'), { target: { value: '東京' } });
    fireEvent.click(await screen.findByTestId('change-poi-search-item-place-1'));
    expect(screen.getByTestId('change-poi-submit')).toHaveTextContent('加入行程');
    fireEvent.click(screen.getByTestId('change-poi-submit'));
    await waitFor(() => expect(apiFetchRaw.mock.calls.some(([url, init]) => url.endsWith('/days/1/entries') && init?.method === 'POST')).toBe(true));
    expect(apiFetchRaw.mock.calls.some(([url]) => url.endsWith('/poi-id') || url.endsWith('/alternates'))).toBe(false);
  });

  it('AddStop reports a saved entry with failed travel recompute without resending it', async () => {
    apiFetchRaw.mockImplementation(async (url) => url.startsWith('/poi-search')
      ? json({ results: [searchRow] })
      : url.includes('/recompute-travel') ? json({ error: 'unavailable' }, 503) : json({ id: 11 }, 201));
    mount('/trip/t1/add-stop?day=1');
    fireEvent.input(screen.getByTestId('add-stop-search-input'), { target: { value: '東京' } });
    fireEvent.click(await screen.findByTestId('add-stop-search-card-place-1'));
    fireEvent.click(screen.getByTestId('add-stop-confirm'));
    await waitFor(() => expect(getToasts().some((toast) => toast.message.includes('車程更新失敗'))).toBe(true));
    expect(apiFetchRaw.mock.calls.filter(([url]) => url.endsWith('/entries'))).toHaveLength(1);
  });

  it('ChangePoi reports a completed replacement when travel recompute fails', async () => {
    apiFetchRaw.mockImplementation(async (url) => url.startsWith('/poi-search')
      ? json({ results: [searchRow] })
      : url.includes('/recompute-travel') ? json({ error: 'unavailable' }, 503) : json({ id: 11 }));
    mount('/trip/t1/stop/42/change-poi?mode=master');
    fireEvent.input(screen.getByTestId('change-poi-search-input'), { target: { value: '東京' } });
    fireEvent.click(await screen.findByTestId('change-poi-search-item-place-1'));
    fireEvent.click(screen.getByTestId('change-poi-submit'));
    await waitFor(() => expect(getToasts().some((toast) => toast.message.includes('車程更新失敗'))).toBe(true));
    expect(apiFetchRaw.mock.calls.filter(([url]) => url.endsWith('/poi-id'))).toHaveLength(1);
  });
});
