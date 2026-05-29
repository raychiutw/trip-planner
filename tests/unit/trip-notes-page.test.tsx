/**
 * TripNotesPage shell test — v2.34.x 行程筆記 PR4
 *
 * Covers (PR4 scope — page shell + accordion frame):
 *   - render trip-notes-page testid
 *   - loading state → 3 skeleton row
 *   - error state → AlertPanel.is-error 顯示 + 重試 button
 *   - empty state (counts=0) → tp-notes-empty-hero + 「建立行程筆記」title + 5 dot
 *   - hasData state → 5 sections render + meta count correct
 *   - 航班 section iconAccent + suggested border when total=0
 *   - AI button 只出現在 pretrip / emergency 兩 section
 *   - chevron toggle aria-expanded
 *   - mobile default: 只 航班 is-open；desktop ≥768px: 5 全 is-open
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import TripNotesPage from '../../src/pages/TripNotesPage';

// Mock dependencies
const apiFetchMock = vi.fn();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string) => apiFetchMock(path),
}));
vi.mock('../../src/hooks/useRequireAuth', () => ({ useRequireAuth: () => ({ ready: true }) }));
vi.mock('../../src/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ email: 'u@test' }) }));
vi.mock('../../src/components/shell/AppShell', () => ({
  default: ({ main }: any) => <div data-testid="app-shell">{main}</div>,
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));
vi.mock('../../src/components/shell/TitleBar', () => ({
  default: ({ title, back }: any) => (
    <div data-testid="titlebar">
      {back && <button data-testid="titlebar-back" onClick={back}>back</button>}
      <span>{title}</span>
    </div>
  ),
}));

function renderPage(tripId = 'trip-1') {
  return render(
    <MemoryRouter initialEntries={[`/trip/${tripId}/notes`]}>
      <Routes>
        <Route path="/trip/:tripId/notes" element={<TripNotesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
  cleanup();
  // Default desktop viewport — mq.matches=false (compact) to test mobile default first
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: false,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('TripNotesPage — shell', () => {
  it('render trip-notes-page testid', async () => {
    apiFetchMock.mockResolvedValue({
      flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('trip-notes-page')).toBeInTheDocument());
  });

  it('loading state — 3 skeleton 在 initial fetch 期間', async () => {
    let resolveFn: (v: any) => void = () => {};
    apiFetchMock.mockReturnValue(new Promise((r) => { resolveFn = r; }));
    renderPage();
    const skels = await screen.findAllByTestId('trip-notes-skeleton');
    expect(skels.length).toBeGreaterThanOrEqual(1);
    resolveFn({ flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [] });
  });

  it('error state — AlertPanel 顯示 + 重試 button', async () => {
    apiFetchMock.mockRejectedValue(new Error('NET_TIMEOUT'));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('alert-panel')).toBeInTheDocument());
    expect(screen.getByTestId('alert-panel').textContent).toContain('無法載入行程筆記');
    expect(screen.getByTestId('alert-panel').textContent).toContain('你的編輯內容還在');
    const retryBtn = screen.getByText('重試');
    expect(retryBtn).toBeInTheDocument();
    // retry triggers refetch
    apiFetchMock.mockResolvedValueOnce({
      flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
    });
    fireEvent.click(retryBtn);
    await waitFor(() => expect(screen.queryByTestId('alert-panel')).not.toBeInTheDocument());
  });

  it('empty state (counts=0) — tp-notes-empty-hero + 5 dot', async () => {
    apiFetchMock.mockResolvedValue({
      flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('trip-notes-empty-hero')).toBeInTheDocument());
    expect(screen.getByTestId('trip-notes-empty-hero').textContent).toContain('建立行程筆記');
    expect(screen.getByTestId('trip-notes-empty-hero').textContent).toContain('航班、住宿、預訂、行前須知、緊急聯絡');
  });

  it('5 sections render with correct meta when empty', async () => {
    apiFetchMock.mockResolvedValue({
      flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('trip-notes-section-flights')).toBeInTheDocument());
    expect(screen.getByTestId('trip-notes-section-lodgings')).toBeInTheDocument();
    expect(screen.getByTestId('trip-notes-section-reservations')).toBeInTheDocument();
    expect(screen.getByTestId('trip-notes-section-pretrip')).toBeInTheDocument();
    expect(screen.getByTestId('trip-notes-section-emergency')).toBeInTheDocument();
  });

  it('航班 section is-suggested border + 建議先填 warn meta when total=0', async () => {
    apiFetchMock.mockResolvedValue({
      flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('trip-notes-section-flights')).toBeInTheDocument());
    const flights = screen.getByTestId('trip-notes-section-flights');
    expect(flights.className).toContain('is-suggested');
    expect(flights.textContent).toContain('建議先填');
  });

  it('AI button 只在 pretrip / emergency 兩 section (v2.34.43: 需展開後才 render)', async () => {
    apiFetchMock.mockResolvedValue({
      flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
    });
    renderPage();
    // v2.34.43 fix: AI button 只在展開後才 render，先 click section head 展開
    await waitFor(() => expect(screen.getByTestId('trip-notes-section-head-pretrip')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('trip-notes-section-head-pretrip'));
    fireEvent.click(screen.getByTestId('trip-notes-section-head-emergency'));
    await waitFor(() => expect(screen.getByTestId('trip-notes-ai-btn-pretrip')).toBeInTheDocument());
    expect(screen.getByTestId('trip-notes-ai-btn-emergency')).toBeInTheDocument();
    expect(screen.queryByTestId('trip-notes-ai-btn-flights')).toBeNull();
    expect(screen.queryByTestId('trip-notes-ai-btn-lodgings')).toBeNull();
    expect(screen.queryByTestId('trip-notes-ai-btn-reservations')).toBeNull();
  });

  it('v2.34.43 — AI button 在 collapsed section 不 render (避免誤觸發)', async () => {
    apiFetchMock.mockResolvedValue({
      flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
    });
    renderPage();
    // Mobile default: 只 flights is-open，pretrip + emergency collapsed
    await waitFor(() => expect(screen.getByTestId('trip-notes-section-pretrip')).toBeInTheDocument());
    expect(screen.getByTestId('trip-notes-section-pretrip').className).not.toContain('is-open');
    expect(screen.getByTestId('trip-notes-section-emergency').className).not.toContain('is-open');
    // AI buttons 不應 render
    expect(screen.queryByTestId('trip-notes-ai-btn-pretrip')).toBeNull();
    expect(screen.queryByTestId('trip-notes-ai-btn-pretrip-lodging')).toBeNull();
    expect(screen.queryByTestId('trip-notes-ai-btn-emergency')).toBeNull();
  });

  it('PR22 — pretrip section render 2 AI buttons (一般 + 住宿)', async () => {
    apiFetchMock.mockResolvedValue({
      flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('trip-notes-section-head-pretrip')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('trip-notes-section-head-pretrip'));
    await waitFor(() => expect(screen.getByTestId('trip-notes-ai-btn-pretrip')).toBeInTheDocument());
    // PR22: lodging-tips trigger button
    expect(screen.getByTestId('trip-notes-ai-btn-pretrip-lodging')).toBeInTheDocument();
    // Labels
    expect(screen.getByTestId('trip-notes-ai-btn-pretrip').textContent).toContain('一般');
    expect(screen.getByTestId('trip-notes-ai-btn-pretrip-lodging').textContent).toContain('住宿');
    // aria-labels distinct
    expect(screen.getByTestId('trip-notes-ai-btn-pretrip').getAttribute('aria-label')).toContain('一般行前須知');
    expect(screen.getByTestId('trip-notes-ai-btn-pretrip-lodging').getAttribute('aria-label')).toContain('住宿在地建議');
  });

  it('PR22 — emergency section still has 1 AI button (no lodging counterpart)', async () => {
    apiFetchMock.mockResolvedValue({
      flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('trip-notes-section-head-emergency')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('trip-notes-section-head-emergency'));
    await waitFor(() => expect(screen.getByTestId('trip-notes-ai-btn-emergency')).toBeInTheDocument());
    expect(screen.queryByTestId('trip-notes-ai-btn-emergency-lodging')).toBeNull();
  });

  it('PR24 — 「住宿」AI button disabled when 0 lodgings (no hotels to base on)', async () => {
    apiFetchMock.mockResolvedValue({
      flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('trip-notes-section-head-pretrip')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('trip-notes-section-head-pretrip'));
    await waitFor(() => expect(screen.getByTestId('trip-notes-ai-btn-pretrip-lodging')).toBeInTheDocument());
    const lodgingBtn = screen.getByTestId('trip-notes-ai-btn-pretrip-lodging');
    expect(lodgingBtn.hasAttribute('disabled')).toBe(true);
    expect(lodgingBtn.getAttribute('title')).toContain('需要先填寫住宿');
    // 「一般」AI button (tips) should remain enabled even with 0 lodgings
    expect(screen.getByTestId('trip-notes-ai-btn-pretrip').hasAttribute('disabled')).toBe(false);
  });

  it('PR24 — 「住宿」AI button enabled when ≥1 lodging exists', async () => {
    apiFetchMock.mockResolvedValue({
      flights: [],
      lodgings: [{ id: 1, sortOrder: 0, name: 'Test Hotel', address: '', checkInAt: '', checkOutAt: '', bookingNo: '', phone: '', note: '', dayId: null, version: 0 }],
      reservations: [],
      pretripNotes: [],
      emergencyContacts: [],
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('trip-notes-section-head-pretrip')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('trip-notes-section-head-pretrip'));
    await waitFor(() => expect(screen.getByTestId('trip-notes-ai-btn-pretrip-lodging')).toBeInTheDocument());
    const lodgingBtn = screen.getByTestId('trip-notes-ai-btn-pretrip-lodging');
    expect(lodgingBtn.hasAttribute('disabled')).toBe(false);
    expect(lodgingBtn.getAttribute('title')).toContain('基於行程飯店');
  });

  it('mobile default — 只 航班 is-open + chevron 旋轉', async () => {
    apiFetchMock.mockResolvedValue({
      flights: [{ id: 1, sortOrder: 0, airline: 'CI', flightNo: 'CI 120' }],
      lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('trip-notes-section-flights')).toBeInTheDocument());
    expect(screen.getByTestId('trip-notes-section-flights').className).toContain('is-open');
    expect(screen.getByTestId('trip-notes-section-lodgings').className).not.toContain('is-open');
  });

  it('section head click → toggle is-open + aria-expanded', async () => {
    apiFetchMock.mockResolvedValue({
      flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('trip-notes-section-head-lodgings')).toBeInTheDocument());
    const head = screen.getByTestId('trip-notes-section-head-lodgings');
    expect(head.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('trip-notes-section-lodgings').className).toContain('is-open');
  });

  it('count meta correct when has data — flights=2 顯「2 個航段」', async () => {
    apiFetchMock.mockResolvedValue({
      flights: [
        { id: 1, sortOrder: 0, airline: 'CI', flightNo: 'CI 120' },
        { id: 2, sortOrder: 1, airline: 'CI', flightNo: 'CI 123' },
      ],
      lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('trip-notes-section-flights')).toBeInTheDocument());
    expect(screen.getByTestId('trip-notes-section-flights').textContent).toContain('2 個航段');
  });

  it('aria-controls maps section head → body', async () => {
    apiFetchMock.mockResolvedValue({
      flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('trip-notes-section-head-flights')).toBeInTheDocument());
    const head = screen.getByTestId('trip-notes-section-head-flights');
    expect(head.getAttribute('aria-controls')).toBe('trip-notes-body-flights');
  });

  it('TitleBar 顯「行程筆記」+ back button', async () => {
    apiFetchMock.mockResolvedValue({
      flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('titlebar')).toBeInTheDocument());
    expect(screen.getByTestId('titlebar').textContent).toContain('行程筆記');
    expect(screen.getByTestId('titlebar-back')).toBeInTheDocument();
  });

  it('apiFetch 路徑對 /trips/:id/notes', async () => {
    apiFetchMock.mockResolvedValue({
      flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
    });
    renderPage('trip-foo');
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/trips/trip-foo/notes'));
  });
});
