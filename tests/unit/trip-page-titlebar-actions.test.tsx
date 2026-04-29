/**
 * TripPage TitleBar actions — Section 4.6 + Section 3.10 (terracotta-mockup-parity-v2)
 *
 * 對齊 mockup section 13：TitleBar 顯示 4 個 ghost button
 *   - 加景點 (Section 3.10) → open AddStopModal
 *   - 建議 → setActiveSheet('suggestions')
 *   - 共編 → setActiveSheet('collab')
 *   - 下載 → handleDownloadFormat('pdf')
 *   - + OverflowMenu kebab
 *
 * 因 TripPage mount 過重 (useTrip 讀 day timeline + leaflet)，我們 mock
 * useTrip 直接吐 fake trip + days，並 stub 重子 component (DaySection,
 * TripSheet, OverflowMenu, BottomNavBar, AppShell, DesktopSidebar...) 為 null
 * 以隔離 TitleBar action button 表面。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const fakeTrip = {
  id: 'okinawa-2026',
  tripId: 'okinawa-2026',
  name: '沖繩 2026',
  title: '沖繩 2026',
  countries: 'JP',
  published: 1,
};

vi.mock('../../src/hooks/useTrip', () => ({
  useTrip: () => ({
    trip: fakeTrip,
    days: [{ id: 1, dayNum: 1, date: '2026-07-26', dayOfWeek: 'Sun', label: '那霸' }],
    currentDay: { id: 1, dayNum: 1, date: '2026-07-26', label: '那霸', timeline: [], hotel: null },
    currentDayNum: 1,
    switchDay: vi.fn(),
    refetchCurrentDay: vi.fn(),
    docs: {},
    allDays: { 1: { id: 1, dayNum: 1, date: '2026-07-26', label: '那霸', timeline: [], hotel: null } },
    loading: false,
    error: null,
  }),
}));

vi.mock('../../src/hooks/useDarkMode', () => ({
  useDarkMode: () => ({ isDark: false, setIsDark: vi.fn(), colorMode: 'light', setColorMode: vi.fn() }),
}));
vi.mock('../../src/hooks/usePrintMode', () => ({
  usePrintMode: () => ({ isPrintMode: false, togglePrint: vi.fn() }),
}));
vi.mock('../../src/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
  registerNetworkCallbacks: vi.fn(),
  reportFetchResult: vi.fn(),
}));
vi.mock('../../src/hooks/useOfflineToast', () => ({
  useOfflineToast: vi.fn(),
}));
vi.mock('../../src/hooks/useScrollRestoreOnBack', () => ({
  useScrollRestoreOnBack: vi.fn(),
}));
vi.mock('../../src/lib/apiClient', () => ({
  // /trips 回 [fakeTrip]（含 published=1）才能讓 TripPage resolve flow 走 'resolved'
  apiFetch: vi.fn().mockImplementation((path: string) => {
    if (path === '/trips') {
      return Promise.resolve([
        { trip_id: 'okinawa-2026', name: '沖繩 2026', title: '沖繩 2026', countries: 'JP', published: 1 },
      ]);
    }
    return Promise.resolve([]);
  }),
  apiFetchRaw: vi.fn(),
}));
vi.mock('../../src/lib/sentry', () => ({
  initSentry: vi.fn(),
  captureException: vi.fn(),
}));

// Stub heavy children that mount own Leaflet / DOM observers
vi.mock('../../src/components/trip/DaySection', () => ({ default: () => null }));
vi.mock('../../src/components/trip/TripSheet', () => ({ default: () => null }));
vi.mock('../../src/components/trip/OverflowMenu', () => ({
  default: () => <button data-testid="trip-overflow-menu">⋯</button>,
}));
vi.mock('../../src/components/shell/BottomNavBar', () => ({ default: () => null }));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/AppShell', () => ({
  default: ({ main }: { main: React.ReactNode }) => <div data-testid="app-shell">{main}</div>,
}));
vi.mock('../../src/components/trip/InfoSheet', () => ({ default: () => null }));
vi.mock('../../src/components/trip/AddStopModal', () => ({
  default: ({ open, dayNum }: { open: boolean; dayNum: number }) =>
    open ? <div data-testid="add-stop-modal-mock" data-day={dayNum}>Mock AddStopModal</div> : null,
}));

import TripPage from '../../src/pages/TripPage';

beforeEach(() => {
  // jsdom 缺 scrollTo / IntersectionObserver
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = (() => {}) as Element['scrollTo'];
  }
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
    root = null;
    rootMargin = '';
    thresholds = [];
  } as unknown as typeof IntersectionObserver;
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/trip/okinawa-2026']}>
      <Routes>
        <Route path="/trip/:tripId" element={<TripPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TripPage TitleBar actions — Section 4.6 + Section 3.10', () => {
  async function renderAndWait() {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('trip-add-stop-trigger')).toBeTruthy(), { timeout: 2000 });
  }

  it('TitleBar render 4 個 action button (加景點/建議/共編/下載) + OverflowMenu', async () => {
    await renderAndWait();
    expect(screen.getByTestId('trip-add-stop-trigger')).toBeTruthy();
    expect(screen.getByLabelText(/AI 建議/)).toBeTruthy();
    expect(screen.getByLabelText(/共編設定/)).toBeTruthy();
    expect(screen.getByLabelText(/下載行程/)).toBeTruthy();
    expect(screen.getByTestId('trip-overflow-menu')).toBeTruthy();
  });

  it('action button 含 icon + text label (desktop ghost button pattern)', async () => {
    await renderAndWait();
    const addStopBtn = screen.getByTestId('trip-add-stop-trigger');
    expect(addStopBtn.querySelector('.svg-icon')).toBeTruthy();
    expect(addStopBtn.querySelector('.tp-titlebar-action-label')?.textContent).toBe('加景點');
  });

  it('「加景點」 button click → AddStopModal 開啟，帶當前 currentDayNum', async () => {
    await renderAndWait();
    expect(screen.queryByTestId('add-stop-modal-mock')).toBeNull();
    fireEvent.click(screen.getByTestId('trip-add-stop-trigger'));
    const modal = screen.getByTestId('add-stop-modal-mock');
    expect(modal).toBeTruthy();
    expect(modal.getAttribute('data-day')).toBe('1');
  });

  it('「建議」 button text label 為「建議」', async () => {
    await renderAndWait();
    const btn = screen.getByLabelText(/AI 建議/);
    expect(btn.querySelector('.tp-titlebar-action-label')?.textContent).toBe('建議');
  });

  it('「共編」 button text label 為「共編」', async () => {
    await renderAndWait();
    const btn = screen.getByLabelText(/共編設定/);
    expect(btn.querySelector('.tp-titlebar-action-label')?.textContent).toBe('共編');
  });

  it('「下載」 button text label 為「下載」', async () => {
    await renderAndWait();
    const btn = screen.getByLabelText(/下載行程/);
    expect(btn.querySelector('.tp-titlebar-action-label')?.textContent).toBe('下載');
  });
});
