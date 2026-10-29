import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NewTripPage from '../../src/pages/NewTripPage';
import EditTripPage from '../../src/pages/EditTripPage';

const apiFetchRaw = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>();
vi.mock('../../src/lib/apiClient', () => ({ apiFetchRaw: (path: string, init?: RequestInit) => apiFetchRaw(path, init) }));

const user = { id: 'u1', email: 'owner@example.com' };
vi.mock('../../src/hooks/useRequireAuth', () => ({ useRequireAuth: () => ({ user }) }));
vi.mock('../../src/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user }) }));
vi.mock('../../src/components/shell/AppShell', () => ({ default: ({ main }: { main: React.ReactNode }) => <>{main}</> }));
vi.mock('../../src/components/shell/OperationShell', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));
vi.mock('../../src/components/AiAuthorizeCard', () => ({ default: () => null }));

const poi = { place_id: 'tokyo', name: '東京', address: '日本', lat: 35.6, lng: 139.7, country: 'JP' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function renderNewTrip() {
  return render(<MemoryRouter initialEntries={['/trips/new']}><NewTripPage /></MemoryRouter>);
}

function renderEditTrip() {
  return render(
    <MemoryRouter initialEntries={['/trip/t1/edit']}>
      <Routes><Route path="/trip/:tripId/edit" element={<EditTripPage />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiFetchRaw.mockReset();
  apiFetchRaw.mockImplementation(async (path) => {
    if (path === '/trips/t1') return json({ title: '東京旅行', destinations: [], published: 0 });
    if (path === '/trips/t1/days?all=1') return json([]);
    if (path.startsWith('/poi-search')) return json({ results: [] });
    return json({});
  });
});

describe('目的地搜尋', () => {
  it('建立行程：200 空結果可見，失敗可重試且保留已選目的地', async () => {
    apiFetchRaw.mockImplementation(async (path) => {
      if (!path.startsWith('/poi-search')) return json({});
      if (path.includes('q=tokyo')) return json({ results: [poi] });
      if (path.includes('q=osaka')) return json({ results: [] });
      if (path.includes('q=kyoto')) return json({ error: 'unavailable' }, 503);
      return json({ results: [] });
    });
    renderNewTrip();
    const input = screen.getByTestId('new-trip-destination-input');
    fireEvent.change(input, { target: { value: 'osaka' } });
    expect(await screen.findByText('沒找到結果，試試別的關鍵字')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'tokyo' } });
    fireEvent.click(await screen.findByTestId('new-trip-dest-result-tokyo'));
    expect(screen.getByTestId('new-trip-destination-row-tokyo')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'kyoto' } });
    expect(await screen.findByRole('button', { name: '重試搜尋' })).toBeTruthy();
    expect(screen.getByTestId('new-trip-destination-row-tokyo')).toBeTruthy();
    apiFetchRaw.mockImplementation(async (path) => path.startsWith('/poi-search') ? json({ results: [] }) : json({}));
    fireEvent.click(screen.getByRole('button', { name: '重試搜尋' }));
    expect(await screen.findByText('沒找到結果，試試別的關鍵字')).toBeTruthy();
    expect(screen.getByTestId('new-trip-destination-row-tokyo')).toBeTruthy();
  });

  it('編輯行程：搜尋失敗後可重試，不把失敗顯示成空結果', async () => {
    apiFetchRaw.mockImplementation(async (path) => {
      if (path === '/trips/t1') return json({ title: '東京旅行', destinations: [{ destOrder: 0, name: '京都', lat: 35, lng: 135 }], published: 0 });
      if (path === '/trips/t1/days?all=1') return json([]);
      if (path.startsWith('/poi-search')) return json({ error: 'unavailable' }, 503);
      return json({});
    });
    renderEditTrip();
    fireEvent.click(await screen.findByTestId('edit-trip-dest-add-btn'));
    fireEvent.change(screen.getByTestId('edit-trip-dest-search-input'), { target: { value: 'kyoto' } });
    expect(await screen.findByRole('button', { name: '重試搜尋' })).toBeTruthy();
    expect(screen.queryByText('沒找到結果，試試別的關鍵字')).toBeNull();
    expect(screen.getByTestId('edit-trip-dest-rows').textContent).toContain('京都');
    apiFetchRaw.mockImplementation(async (path) => {
      if (path === '/trips/t1') return json({ title: '東京旅行', destinations: [{ destOrder: 0, name: '京都', lat: 35, lng: 135 }], published: 0 });
      if (path === '/trips/t1/days?all=1') return json([]);
      return json({ results: [poi] });
    });
    fireEvent.click(screen.getByRole('button', { name: '重試搜尋' }));
    const result = await screen.findByTestId('edit-trip-dest-result-tokyo');
    expect(screen.getByTestId('edit-trip-dest-rows').textContent).toContain('京都');
    fireEvent.keyDown(screen.getByTestId('edit-trip-dest-search-input'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(result);
    fireEvent.keyDown(result, { key: 'Enter' });
    expect(screen.getByTestId('edit-trip-dest-rows').textContent).toContain('東京');
    expect(document.activeElement).toBe(screen.getByTestId('edit-trip-dest-add-btn'));
  });

  it('建立行程：鍵盤方向鍵可選候選，Escape 可關閉候選', async () => {
    apiFetchRaw.mockImplementation(async (path) => path.startsWith('/poi-search')
      ? json({ results: [poi, { ...poi, place_id: 'osaka', name: '大阪' }] })
      : json({}));
    renderNewTrip();
    const input = screen.getByTestId('new-trip-destination-input');
    fireEvent.change(input, { target: { value: 'japan' } });
    const first = await screen.findByTestId('new-trip-dest-result-tokyo');
    const second = screen.getByTestId('new-trip-dest-result-osaka');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: 'Enter' });
    expect(screen.getByTestId('new-trip-destination-row-osaka')).toBeTruthy();
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'japan' } });
    await screen.findByTestId('new-trip-dest-result-tokyo');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('new-trip-dest-dropdown')).toBeNull();
  });
});
