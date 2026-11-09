import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

const requests: Array<{ path: string; init?: RequestInit }> = [];
const listeners = new Map<string, () => void>();
let center = { lat: 35, lng: 139 };
let resolveFails = false;
let mapLoadError: Error | null = null;
const flyTo = vi.fn();
const map = {
  addListener: (name: string, callback: () => void) => {
    listeners.set(name, callback);
    return { remove: () => listeners.delete(name) };
  },
  getCenter: () => ({ lat: () => center.lat, lng: () => center.lng }),
  getZoom: () => 14,
  panBy: () => { center = { lat: 36, lng: 140 }; },
};

vi.mock('../../src/hooks/useGoogleMap', () => ({
  useGoogleMap: () => ({ containerRef: { current: null }, map: mapLoadError ? null : map, loadError: mapLoadError, flyTo }),
}));
vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ user: { id: 'u1', email: 'u@example.com' } }),
}));
vi.mock('../../src/components/shell/AppShell', () => ({
  default: ({ main }: { main: ReactNode }) => <>{main}</>,
}));
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: vi.fn(async (path: string) => {
    if (path.endsWith('/days?all=1')) return [{ id: 1, dayNum: 1, date: '2026-10-01', timeline: [] }];
    if (path === '/trips/t1') return { destinations: [] };
    if (path === '/places/autocomplete') return { predictions: [{ placeId: 'p1', primaryText: '東京塔', secondaryText: '日本' }] };
    return {};
  }),
  apiFetchRaw: vi.fn(async (path: string, init?: RequestInit) => {
    requests.push({ path, init });
    if (path.startsWith('/places/resolve') && resolveFails) {
      return { ok: false, status: 503 } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ id: 1 }), text: async () => '' } as Response;
  }),
}));
vi.mock('../../src/lib/travelRecompute', () => ({ requestTravelRecompute: vi.fn(async () => true) }));

import AddCustomStopPage from '../../src/pages/AddCustomStopPage';

function openPage() {
  const router = createMemoryRouter([
    { path: '/trip/:tripId/add-custom-stop', element: <AddCustomStopPage /> },
    { path: '/trip/:tripId', element: <div>行程詳情</div> },
  ], { initialEntries: ['/trip/t1/add-custom-stop?day=1'] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  requests.length = 0;
  listeners.clear();
  center = { lat: 35, lng: 139 };
  resolveFails = false;
  mapLoadError = null;
  window.scrollTo = vi.fn();
});

/**
 * 重送 ArrowDown 直到 option 被選取。Headless UI 在 option 註冊完成前會吞掉按鍵，光等不會重送。
 * 有界迴圈而不是把 fireEvent 放進 waitFor：waitFor 以 MutationObserver 重跑回呼，
 * 若每次按鍵都改 DOM，會形成微任務迴圈餓死逾時計時器，壞掉時整個 worker 卡死而不是報錯。
 */
async function arrowDownUntilSelected(address: HTMLElement, option: HTMLElement) {
  for (let i = 0; i < 10; i++) {
    fireEvent.keyDown(address, { key: 'ArrowDown' });
    try {
      await waitFor(() => expect(option).toHaveAttribute('aria-selected', 'true'), { timeout: 300 });
      return;
    } catch { /* 按鍵可能被吞掉，重送 */ }
  }
  expect(option).toHaveAttribute('aria-selected', 'true');
}

describe('AddCustomStopPage public form', () => {
  it('cannot submit a viewport default, validates duration, then sends only the dragged coordinate', async () => {
    openPage();
    const title = screen.getByRole('textbox', { name: '標題' });
    fireEvent.change(title, { target: { value: '朋友家' } });
    await screen.findByRole('application');
    await waitFor(() => expect(listeners.has('idle')).toBe(true));
    act(() => listeners.get('idle')!());
    expect(screen.getByRole('button', { name: '完成' })).toBeDisabled();
    expect(requests.filter((r) => r.init?.method === 'POST')).toHaveLength(0);

    center = { lat: 36, lng: 140 };
    act(() => {
      listeners.get('dragstart')!();
      listeners.get('idle')!();
    });
    await waitFor(() => expect(screen.getByRole('button', { name: '完成' })).toBeEnabled());
    fireEvent.change(screen.getByRole('spinbutton', { name: '停留時間（分鐘）' }), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: '完成' }));
    await screen.findByText('停留時間請輸入正整數分鐘');
    expect(requests.filter((r) => r.init?.method === 'POST')).toHaveLength(0);

    fireEvent.change(screen.getByRole('spinbutton', { name: '停留時間（分鐘）' }), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: '完成' }));
    await waitFor(() => expect(requests.filter((r) => r.init?.method === 'POST')).toHaveLength(1));
    const post = requests.find((r) => r.init?.method === 'POST')!;
    expect(JSON.parse(String(post.init?.body))).toMatchObject({ name: '朋友家', lat: 36, lng: 140, note: '30 分' });
  });

  it('protects an address-only draft on return', async () => {
    const router = openPage();
    await screen.findByRole('application');
    fireEvent.change(screen.getByRole('combobox', { name: '地址或地標' }), { target: { value: '東京' } });
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.getByText('捨棄未儲存的景點？')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/trip/t1/add-custom-stop');
    fireEvent.click(screen.getByRole('button', { name: '繼續編輯' }));
    expect((screen.getByRole('combobox', { name: '地址或地標' }) as HTMLInputElement).value).toBe('東京');

    await act(async () => { await router.navigate('/trip/t1'); });
    expect(router.state.location.pathname).toBe('/trip/t1/add-custom-stop');
    expect(screen.getByText('捨棄未儲存的景點？')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '捨棄' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/trip/t1'));
  });

  it('reports an address candidate that cannot be resolved without inventing a coordinate', async () => {
    resolveFails = true;
    openPage();
    const address = screen.getByRole('combobox', { name: '地址或地標' });
    fireEvent.change(address, { target: { value: '東京塔-1326' } });
    const option = await screen.findByRole('option', { name: /東京塔/ });
    await arrowDownUntilSelected(address, option);
    fireEvent.keyDown(address, { key: 'Enter' });
    await screen.findByText(/無法取得此地址的位置/);
    expect(screen.getByRole('button', { name: '完成' })).toBeDisabled();
    expect(requests.filter((r) => r.init?.method === 'POST' && r.path.includes('/entries'))).toHaveLength(0);
  });

  function expectLinked(input: HTMLElement, text: RegExp) {
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const target = document.getElementById(input.getAttribute('aria-describedby')!);
    expect(target?.textContent).toMatch(text);
    expect(target?.closest('[role="alert"]')).toBeTruthy();
  }
  function expectClean(input: HTMLElement) {
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  }

  it('links the address error to the address field and drops it once the user edits (#1561)', async () => {
    resolveFails = true;
    openPage();
    const address = screen.getByRole('combobox', { name: '地址或地標' });
    expectClean(address);
    fireEvent.change(address, { target: { value: '東京塔-1326' } });
    const option = await screen.findByRole('option', { name: /東京塔/ });
    await arrowDownUntilSelected(address, option);
    fireEvent.keyDown(address, { key: 'Enter' });
    await screen.findByText(/無法取得此地址的位置/);
    expectLinked(address, /無法取得此地址的位置/);
    fireEvent.change(address, { target: { value: '東京' } });
    expectClean(address);
  });

  it('links the duration error to the duration field and drops it once corrected (#1561)', async () => {
    openPage();
    fireEvent.change(screen.getByRole('textbox', { name: '標題' }), { target: { value: '朋友家' } });
    await screen.findByRole('application');
    await waitFor(() => expect(listeners.has('idle')).toBe(true));
    center = { lat: 36, lng: 140 };
    act(() => { listeners.get('dragstart')!(); listeners.get('idle')!(); });
    await waitFor(() => expect(screen.getByRole('button', { name: '完成' })).toBeEnabled());
    const duration = screen.getByRole('spinbutton', { name: '停留時間（分鐘）' });
    expectClean(duration);
    fireEvent.change(duration, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: '完成' }));
    await screen.findByText('停留時間請輸入正整數分鐘');
    expectLinked(duration, /停留時間請輸入正整數分鐘/);
    fireEvent.change(duration, { target: { value: '30' } });
    expectClean(duration);
  });

  it('explains map failure and keeps the existing return path available', async () => {
    mapLoadError = new Error('Google Maps denied');
    const router = openPage();
    await screen.findByText(/無法載入地圖，位置尚未選定/);
    expect(screen.getByRole('button', { name: '完成' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/trip/t1'));
    expect(screen.getByText('行程詳情')).toBeTruthy();
    expect(requests.filter((r) => r.init?.method === 'POST' && r.path.includes('/entries'))).toHaveLength(0);
  });
});
