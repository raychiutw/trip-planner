import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import TripSharePage from '../../src/pages/TripSharePage';
import LoginPage from '../../src/pages/LoginPage';

vi.mock('../../src/components/print/renderTripPrintPdf', () => ({ renderTripPrintPdf: vi.fn() }));

const tokenA = 'tok_abc123def456ghi789';
const tokenB = 'tok_xyz123def456ghi789';
const payload = (title: string) => ({
  meta: { name: title, title, countries: 'JP', sharedBy: 'Ray', destinations: [{ name: '那霸' }] },
  days: [],
  notes: { flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [] },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

function renderAt(token = tokenA) {
  return render(<MemoryRouter initialEntries={[`/s/${token}`]}><Routes>
    <Route path="/s/:token" element={<TripSharePage />} />
  </Routes></MemoryRouter>);
}

function renderWithSwitch() {
  return render(<MemoryRouter initialEntries={[`/s/${tokenA}`]}>
    <Link to={`/s/${tokenB}`}>下一份分享</Link>
    <Link to={`/s/${tokenA}`}>原分享</Link>
    <Routes><Route path="/s/:token" element={<TripSharePage />} /></Routes>
  </MemoryRouter>);
}

beforeEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });
afterEach(() => vi.unstubAllGlobals());

describe('public share read contract', () => {
  it('retries a temporary server failure and restores the same share without cloning', async () => {
    let attempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/oauth/userinfo') return json({}, 401);
      if (String(input) === `/api/share/${tokenA}`) {
        return ++attempts === 1 ? json({ error: 'SYS_INTERNAL' }, 500) : json(payload('沖繩五日'));
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderAt();

    await waitFor(() => expect(screen.getByTestId('share-error')).toBeTruthy());
    expect(screen.queryByTestId('share-notfound')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '重試' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '沖繩五日', level: 1 })).toBeTruthy());
    expect(screen.getByTestId('trip-print-document')).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([path]) => String(path).endsWith('/clone'))).toHaveLength(0);
  });

  it('ignores a late response for the previous token', async () => {
    let resolveOld!: (response: Response) => void;
    const oldRead = new Promise<Response>((resolve) => { resolveOld = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/oauth/userinfo') return json({}, 401);
      if (String(input) === `/api/share/${tokenA}`) return oldRead;
      if (String(input) === `/api/share/${tokenB}`) return json(payload('京都三日'));
      throw new Error(`Unexpected request: ${String(input)}`);
    }));
    renderWithSwitch();
    fireEvent.click(screen.getByRole('link', { name: '下一份分享' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '京都三日' })).toBeTruthy());
    resolveOld(json(payload('沖繩五日')));
    await waitFor(() => expect(screen.queryByText('沖繩五日')).toBeNull());
  });

  it('hides the previous trip as soon as the token changes', async () => {
    let resolveNext!: (response: Response) => void;
    const nextRead = new Promise<Response>((resolve) => { resolveNext = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/oauth/userinfo') return json({}, 401);
      if (String(input) === `/api/share/${tokenA}`) return json(payload('沖繩五日'));
      if (String(input) === `/api/share/${tokenB}`) return nextRead;
      throw new Error(`Unexpected request: ${String(input)}`);
    }));
    renderWithSwitch();
    await waitFor(() => expect(screen.getByRole('heading', { name: '沖繩五日' })).toBeTruthy());
    fireEvent.click(screen.getByRole('link', { name: '下一份分享' }));
    expect(screen.queryByText('沖繩五日')).toBeNull();
    expect(screen.getByTestId('share-loading')).toBeTruthy();
    resolveNext(json(payload('京都三日')));
    await waitFor(() => expect(screen.getByRole('heading', { name: '京都三日' })).toBeTruthy());
  });

  it.each([404, 410])('shows an expired link only for an explicit %s response', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/oauth/userinfo') return json({}, 401);
      if (String(input) === `/api/share/${tokenA}`) return json({ error: 'NOT_FOUND' }, status);
      throw new Error(`Unexpected request: ${String(input)}`);
    }));
    renderAt();
    await waitFor(() => expect(screen.getByTestId('share-notfound')).toBeTruthy());
    expect(screen.queryByRole('button', { name: '重試' })).toBeNull();
  });

  it('retries a network failure', async () => {
    let attempts = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/oauth/userinfo') return json({}, 401);
      if (String(input) === `/api/share/${tokenA}`) {
        if (++attempts === 1) throw new TypeError('offline');
        return json(payload('沖繩五日'));
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    }));
    renderAt();
    await waitFor(() => expect(screen.getByTestId('share-error')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: '重試' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '沖繩五日' })).toBeTruthy());
  });

  it('returns to the same share after login and clones only on a new copy action', async () => {
    let loggedIn = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/oauth/userinfo') {
        return loggedIn ? json({ id: 'u1', email: 'test@example.com', emailVerified: true, displayName: 'Test', avatarUrl: null, createdAt: '' }) : json({}, 401);
      }
      if (path === `/api/share/${tokenA}`) return json(payload('沖繩五日'));
      if (path === '/api/public-config') return json({ providers: { google: false } });
      if (path === '/api/oauth/login') { loggedIn = true; return json({ ok: true }); }
      if (path === `/api/share/${tokenA}/clone`) return json({ tripId: 'new-trip' });
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    function TripDestination() {
      const location = useLocation();
      return <div data-testid="trip-destination">{location.search}</div>;
    }
    render(<MemoryRouter initialEntries={[`/s/${tokenA}`]}><Routes>
      <Route path="/s/:token" element={<TripSharePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/trips" element={<TripDestination />} />
    </Routes></MemoryRouter>);

    await waitFor(() => expect(screen.getByTestId('share-copy')).toBeTruthy());
    fireEvent.click(screen.getByTestId('share-copy'));
    await waitFor(() => expect(screen.getByTestId('login-page')).toBeTruthy());
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByTestId('login-submit'));
    await waitFor(() => expect(screen.getByRole('heading', { name: '沖繩五日' })).toBeTruthy());
    expect(fetchMock.mock.calls.filter(([path]) => String(path).endsWith('/clone'))).toHaveLength(0);
    fireEvent.click(screen.getByTestId('share-copy'));
    await waitFor(() => expect(screen.getByTestId('trip-destination').textContent).toBe('?selected=new-trip'));
    expect(fetchMock.mock.calls.filter(([path]) => String(path).endsWith('/clone'))).toHaveLength(1);
  });

  it('does not duplicate a pending clone and allows an explicit retry after failure', async () => {
    let rejectFirst!: (error: Error) => void;
    const firstClone = new Promise<Response>((_, reject) => { rejectFirst = reject; });
    let cloneCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/oauth/userinfo') return json({ id: 'u1', email: 'test@example.com', emailVerified: true, displayName: 'Test', avatarUrl: null, createdAt: '' });
      if (path === `/api/share/${tokenA}`) return json(payload('沖繩五日'));
      if (path === `/api/share/${tokenA}/clone`) return ++cloneCount === 1 ? firstClone : json({ tripId: 'new-trip' });
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    function TripDestination() { return <div data-testid="trip-destination" />; }
    render(<MemoryRouter initialEntries={[`/s/${tokenA}`]}><Routes>
      <Route path="/s/:token" element={<TripSharePage />} />
      <Route path="/trips" element={<TripDestination />} />
    </Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('share-copy')).toBeTruthy());
    fireEvent.click(screen.getByTestId('share-copy'));
    fireEvent.click(screen.getByTestId('share-copy'));
    expect(fetchMock.mock.calls.filter(([path]) => String(path).endsWith('/clone'))).toHaveLength(1);
    rejectFirst(new Error('network'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('複製失敗'));
    fireEvent.click(screen.getByTestId('share-copy'));
    await waitFor(() => expect(screen.getByTestId('trip-destination')).toBeTruthy());
    expect(fetchMock.mock.calls.filter(([path]) => String(path).endsWith('/clone'))).toHaveLength(2);
  });

  it('does not let an old token clone redirect or disable the new share', async () => {
    let resolveClone!: (response: Response) => void;
    const oldClone = new Promise<Response>((resolve) => { resolveClone = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/oauth/userinfo') return json({ id: 'u1', email: 'test@example.com', emailVerified: true, displayName: 'Test', avatarUrl: null, createdAt: '' });
      if (path === `/api/share/${tokenA}`) return json(payload('沖繩五日'));
      if (path === `/api/share/${tokenB}`) return json(payload('京都三日'));
      if (path === `/api/share/${tokenA}/clone`) return oldClone;
      throw new Error(`Unexpected request: ${path}`);
    }));
    renderWithSwitch();
    await waitFor(() => expect(screen.getByRole('heading', { name: '沖繩五日' })).toBeTruthy());
    fireEvent.click(screen.getByTestId('share-copy'));
    await waitFor(() => expect((screen.getByTestId('share-copy') as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(screen.getByRole('link', { name: '下一份分享' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '京都三日' })).toBeTruthy());
    await act(async () => { resolveClone(json({ tripId: 'old-trip' })); });
    expect(screen.getByRole('heading', { name: '京都三日' })).toBeTruthy();
    expect((screen.getByTestId('share-copy') as HTMLButtonElement).disabled).toBe(false);
  });

  it('treats a return to the same token as a new visit for pending clone work', async () => {
    let resolveOldClone!: (response: Response) => void;
    const oldClone = new Promise<Response>((resolve) => { resolveOldClone = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/oauth/userinfo') return json({ id: 'u1', email: 'test@example.com', emailVerified: true, displayName: 'Test', avatarUrl: null, createdAt: '' });
      if (path === `/api/share/${tokenA}`) return json(payload('沖繩五日'));
      if (path === `/api/share/${tokenB}`) return json(payload('京都三日'));
      if (path === `/api/share/${tokenA}/clone`) return oldClone;
      throw new Error(`Unexpected request: ${path}`);
    }));
    renderWithSwitch();
    await waitFor(() => expect(screen.getByRole('heading', { name: '沖繩五日' })).toBeTruthy());
    fireEvent.click(screen.getByTestId('share-copy'));
    fireEvent.click(screen.getByRole('link', { name: '下一份分享' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '京都三日' })).toBeTruthy());
    fireEvent.click(screen.getByRole('link', { name: '原分享' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '沖繩五日' })).toBeTruthy());
    await act(async () => { resolveOldClone(json({ tripId: 'old-trip' })); });
    expect(screen.getByRole('heading', { name: '沖繩五日' })).toBeTruthy();
    expect((screen.getByTestId('share-copy') as HTMLButtonElement).disabled).toBe(false);
  });

  it('waits for the sign-in check before deciding whether copy needs login', async () => {
    let resolveUser!: (response: Response) => void;
    const pendingUser = new Promise<Response>((resolve) => { resolveUser = resolve; });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/oauth/userinfo') return pendingUser;
      if (path === `/api/share/${tokenA}`) return json(payload('沖繩五日'));
      if (path === `/api/share/${tokenA}/clone`) return json({ tripId: 'new-trip' });
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    function TripDestination() { return <div data-testid="trip-destination" />; }
    render(<MemoryRouter initialEntries={[`/s/${tokenA}`]}><Routes>
      <Route path="/s/:token" element={<TripSharePage />} />
      <Route path="/trips" element={<TripDestination />} />
    </Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('share-copy')).toBeTruthy());
    expect((screen.getByTestId('share-copy') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { resolveUser(json({ id: 'u1', email: 'test@example.com', emailVerified: true, displayName: 'Test', avatarUrl: null, createdAt: '' })); });
    await waitFor(() => expect((screen.getByTestId('share-copy') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('share-copy'));
    await waitFor(() => expect(screen.getByTestId('trip-destination')).toBeTruthy());
    expect(fetchMock.mock.calls.filter(([path]) => String(path).endsWith('/clone'))).toHaveLength(1);
  });
});
