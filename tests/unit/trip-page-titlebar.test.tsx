/**
 * TripPage standalone chrome — Terracotta TitleBar migration.
 *
 * The /trip/:id route owns its own page chrome. Embedded TripPage remains
 * chrome-less because TripsListPage supplies the host TitleBar.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const fakes = vi.hoisted(() => ({
  openSheet: vi.fn(),
  downloadTripFormat: vi.fn(),
  togglePrint: vi.fn(),
}));

vi.mock('../../src/components/shell/TitleBar', () => ({
  default: ({ title, back, actions, backLabel = '返回' }: {
    title: React.ReactNode;
    back?: () => void;
    actions?: React.ReactNode;
    backLabel?: string;
  }) => (
    <header data-testid="trip-titlebar">
      {back && <button type="button" aria-label={backLabel} onClick={back}>back</button>}
      <h1>{title}</h1>
      <div data-testid="trip-titlebar-actions">{actions}</div>
    </header>
  ),
}));

vi.mock('../../src/components/shell/AppShell', () => ({
  default: ({ main }: { main: React.ReactNode }) => <div data-testid="app-shell">{main}</div>,
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/BottomNavBar', () => ({ default: () => null }));
vi.mock('../../src/components/trip/TripSheet', () => ({ default: () => null }));
vi.mock('../../src/components/trip/InfoSheet', () => ({
  default: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) => (
    open ? <div role="dialog" aria-label={title}>{children}</div> : null
  ),
}));
vi.mock('../../src/components/trip/TripSheetContent', () => ({
  SHEET_TITLES: {
    suggestions: 'AI 建議',
    collab: '共編設定',
    emergency: '緊急資訊',
    'trip-select': '切換行程',
  },
  default: ({ activeSheet }: { activeSheet: string | null }) => {
    if (activeSheet) fakes.openSheet(activeSheet);
    return <div data-testid="trip-sheet-content">{activeSheet}</div>;
  },
}));
vi.mock('../../src/components/trip/DayNav', () => ({ default: () => <nav data-testid="day-nav" /> }));
vi.mock('../../src/components/trip/DaySection', () => ({
  default: ({ dayNum }: { dayNum: number }) => <section data-testid={`day-section-${dayNum}`} id={`day${dayNum}`} />,
}));
vi.mock('../../src/components/trip/DaySkeleton', () => ({ default: () => <div data-testid="day-skeleton" /> }));
vi.mock('../../src/components/trip/Footer', () => ({ default: () => null }));
vi.mock('../../src/components/trip/ThemeArt', () => ({ FooterArt: () => null }));
vi.mock('../../src/components/trip/DestinationArt', () => ({ default: () => null }));
vi.mock('../../src/components/shared/Toast', () => ({ default: () => null }));
vi.mock('../../src/hooks/useTrip', () => ({
  useTrip: () => ({
    trip: {
      id: 'okinawa-trip',
      tripId: 'okinawa-trip',
      title: '2026 沖繩自駕五日遊',
      name: '沖繩自駕五日遊',
      description: '',
      ogDescription: '',
      footer: null,
    },
    days: [{ dayNum: 1, date: '2026-07-01', dayOfWeek: '三', label: '那霸' }],
    currentDay: { id: 1, dayNum: 1, date: '2026-07-01', timeline: [] },
    currentDayNum: 1,
    switchDay: vi.fn(),
    refetchCurrentDay: vi.fn(),
    allDays: { 1: { id: 1, dayNum: 1, date: '2026-07-01', timeline: [] } },
    docs: {},
    loading: false,
    error: null,
  }),
}));
vi.mock('../../src/hooks/useDarkMode', () => ({
  useDarkMode: () => ({ isDark: false, setIsDark: vi.fn(), colorMode: 'auto', setColorMode: vi.fn() }),
}));
vi.mock('../../src/hooks/usePrintMode', () => ({
  usePrintMode: () => ({ isPrintMode: false, togglePrint: fakes.togglePrint }),
}));
vi.mock('../../src/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));
vi.mock('../../src/hooks/useOfflineToast', () => ({ useOfflineToast: () => {} }));
vi.mock('../../src/hooks/useScrollRestoreOnBack', () => ({ useScrollRestoreOnBack: () => {} }));
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: vi.fn().mockResolvedValue([
    { tripId: 'okinawa-trip', id: 'okinawa-trip', name: '沖繩自駕五日遊', title: '2026 沖繩自駕五日遊', published: 1 },
  ]),
}));
vi.mock('../../src/lib/tripExport', () => ({ downloadTripFormat: fakes.downloadTripFormat }));
vi.mock('../../src/lib/sentry', () => ({ captureError: vi.fn() }));

import TripPage from '../../src/pages/TripPage';

function renderTripPage(path = '/trip/okinawa-trip') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/trip/:tripId" element={<TripPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TripPage standalone TitleBar', () => {
  beforeEach(() => {
    fakes.openSheet.mockClear();
    fakes.downloadTripFormat.mockClear();
    fakes.togglePrint.mockClear();
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders TitleBar with trip title and left back action instead of ocean-topbar', async () => {
    const { container } = renderTripPage();

    await waitFor(() => expect(screen.queryByTestId('trip-titlebar')).toBeTruthy());

    expect(screen.getByRole('heading', { name: '2026 沖繩自駕五日遊' })).toBeTruthy();
    expect(screen.getByLabelText('返回行程列表')).toBeTruthy();
    expect(container.querySelector('.ocean-topbar')).toBeNull();
  });

  it('exposes desktop titlebar actions for suggestions, collab, download, and more', async () => {
    renderTripPage();

    await waitFor(() => expect(screen.queryByTestId('trip-titlebar-actions')).toBeTruthy());

    expect(screen.getByLabelText('開啟 AI 建議')).toBeTruthy();
    expect(screen.getByLabelText('開啟共編設定')).toBeTruthy();
    expect(screen.getByLabelText('下載行程')).toBeTruthy();
    expect(screen.getByLabelText('更多功能')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('開啟 AI 建議'));
    await waitFor(() => expect(fakes.openSheet).toHaveBeenCalledWith('suggestions'));

    fireEvent.click(screen.getByLabelText('開啟共編設定'));
    await waitFor(() => expect(fakes.openSheet).toHaveBeenCalledWith('collab'));

    fireEvent.click(screen.getByLabelText('下載行程'));
    await waitFor(() => expect(fakes.downloadTripFormat).toHaveBeenCalledWith(
      'pdf',
      expect.objectContaining({ tripId: 'okinawa-trip' }),
    ));
  });
});
