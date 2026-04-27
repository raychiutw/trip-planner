/**
 * LoginPage unit test — V2 sign-in form + lockout
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../../src/pages/LoginPage';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function renderAt(query = '') {
  return render(
    <MemoryRouter initialEntries={[`/login${query ? `?${query}` : ''}`]}>
      <LoginPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateMock.mockClear();
  sessionStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-25T00:00:00Z'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  sessionStorage.clear();
});

describe('LoginPage form', () => {
  it('renders email + password + submit + signup link (Google hidden until probe confirms)', () => {
    renderAt();
    expect(screen.getByTestId('login-email')).toBeTruthy();
    expect(screen.getByTestId('login-password')).toBeTruthy();
    expect(screen.getByTestId('login-submit')).toBeTruthy();
    expect(screen.getByTestId('login-signup-link')).toBeTruthy();
    expect(screen.getByTestId('login-forgot-link')).toBeTruthy();
    // Google button is gated on /api/public-config probe (not stubbed here, so absent)
    expect(screen.queryByTestId('login-google')).toBeNull();
  });

  it('shows Google button when /api/public-config reports it enabled', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ providers: { google: true } }), { status: 200 }),
    ));
    vi.useRealTimers();
    renderAt();
    await waitFor(() => expect(screen.queryByTestId('login-google')).not.toBeNull());
  });

  it('successful login → navigate /manage by default', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, userId: 'u1', email: 'u@x.com' }), { status: 200 }),
    ));
    vi.useRealTimers();

    renderAt();
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'u@x.com' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByTestId('login-submit'));

    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(navigateMock.mock.calls[0]![0]).toBe('/trips');
  });

  it('successful login navigates to redirect_after when present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, userId: 'u1', email: 'u@x.com' }), { status: 200 }),
    ));
    vi.useRealTimers();

    renderAt('redirect_after=%2Fexplore');
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'u@x.com' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByTestId('login-submit'));

    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(navigateMock.mock.calls[0]![0]).toBe('/explore');
  });

  it('open redirect protection: //evil → fallback /trips', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ));
    vi.useRealTimers();

    renderAt('redirect_after=%2F%2Fevil.com');
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'u@x.com' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByTestId('login-submit'));

    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(navigateMock.mock.calls[0]![0]).toBe('/trips');
  });

  it('LOGIN_INVALID → error banner + bumps fail counter', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'LOGIN_INVALID', message: 'bad' } }),
        { status: 401 },
      ),
    ));
    vi.useRealTimers();

    renderAt();
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'u@x.com' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByTestId('login-submit'));

    await waitFor(() => expect(screen.queryByTestId('login-banner-error')).toBeTruthy());
    expect(screen.getByTestId('login-banner-error').textContent).toContain('email 或密碼');
    expect(sessionStorage.getItem('tp_login_fail_count')).toBe('1');
  });

  it('Network failure → generic error banner', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    vi.useRealTimers();

    renderAt();
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'u@x.com' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByTestId('login-submit'));

    await waitFor(() => expect(screen.queryByTestId('login-banner-error')).toBeTruthy());
    expect(screen.getByTestId('login-banner-error').textContent).toContain('網路');
  });

  it('?verified=1 → success banner', () => {
    renderAt('verified=1');
    expect(screen.getByTestId('login-banner-verified')).toBeTruthy();
  });

  it('?verify_error=expired → warning banner', () => {
    renderAt('verify_error=expired');
    expect(screen.getByTestId('login-banner-verify-error').textContent).toContain('過期');
  });

  it('shows defensive warning when failure count ≥ 4', () => {
    sessionStorage.setItem('tp_login_fail_count', '4');
    renderAt();
    expect(screen.getByTestId('login-banner-fail-warn')).toBeTruthy();
  });

  it('Successful login clears fail counter', async () => {
    sessionStorage.setItem('tp_login_fail_count', '3');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ));
    vi.useRealTimers();

    renderAt();
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'u@x.com' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByTestId('login-submit'));

    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(sessionStorage.getItem('tp_login_fail_count')).toBeNull();
  });
});

describe('LoginPage lockout', () => {
  it('LOGIN_RATE_LIMITED → switches to full-screen lockout with countdown', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'LOGIN_RATE_LIMITED', message: 'locked' } }),
        { status: 429, headers: { 'Retry-After': '1800' } },
      ),
    ));
    vi.useRealTimers();

    renderAt();
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'u@x.com' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByTestId('login-submit'));

    await waitFor(() => expect(screen.queryByTestId('login-page-locked')).toBeTruthy());
    expect(screen.getByTestId('login-locked-countdown').textContent).toBe('30:00');
    expect(screen.getByTestId('login-locked-reset')).toBeTruthy();
  });

  it('Lockout includes 重設密碼 link to /login/forgot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'LOGIN_RATE_LIMITED' } }),
        { status: 429, headers: { 'Retry-After': '60' } },
      ),
    ));
    vi.useRealTimers();

    renderAt();
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'u@x.com' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByTestId('login-submit'));

    await waitFor(() => expect(screen.queryByTestId('login-locked-reset')).toBeTruthy());
    const link = screen.getByTestId('login-locked-reset') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/login/forgot');
  });
});

describe('LoginPage with ?invitation=token (V2 共編)', () => {
  /** Mock fetch by URL (public-config probe + login + accept all go through fetch) */
  function stubByRoute(routes: Array<{ match: RegExp; status: number; body: unknown }>) {
    const fn = vi.fn().mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      const route = routes.find((r) => r.match.test(url));
      if (!route) return Promise.resolve(new Response('Not Found', { status: 404 }));
      return Promise.resolve(new Response(JSON.stringify(route.body), {
        status: route.status,
        headers: { 'content-type': 'application/json' },
      }));
    });
    vi.stubGlobal('fetch', fn);
    return fn;
  }

  it('after login success, accept invitation + window.location.href redirect to trip', async () => {
    const fetchMock = stubByRoute([
      { match: /\/api\/public-config/, status: 200, body: {} },
      { match: /\/api\/oauth\/login(?!\/google)/, status: 200, body: { ok: true } },
      { match: /\/api\/invitations\/accept/, status: 200, body: { ok: true, tripId: 'trip-1', tripTitle: '沖繩' } },
    ]);
    vi.useRealTimers();

    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: 'about:blank', assign: vi.fn() },
      writable: true,
    });

    renderAt('invitation=invite-tok');
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'u@x.com' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'goodpass' } });
    fireEvent.click(screen.getByTestId('login-submit'));

    await waitFor(() => {
      const acceptCall = fetchMock.mock.calls.find(
        (c) => typeof c[0] === 'string' && (c[0] as string).includes('/api/invitations/accept'),
      );
      expect(acceptCall).toBeTruthy();
    });
    const acceptCall = fetchMock.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('/api/invitations/accept'),
    )!;
    const init = acceptCall[1] as RequestInit;
    const body = JSON.parse(init.body as string) as { token: string };
    expect(body.token).toBe('invite-tok');

    await waitFor(() => expect(window.location.href).toContain('/trips?selected=trip-1'));
  });

  it('without ?invitation: navigates to /trips (default behavior unchanged)', async () => {
    const fetchMock = stubByRoute([
      { match: /\/api\/public-config/, status: 200, body: {} },
      { match: /\/api\/oauth\/login/, status: 200, body: { ok: true } },
    ]);
    vi.useRealTimers();

    renderAt();
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'u@x.com' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'goodpass' } });
    fireEvent.click(screen.getByTestId('login-submit'));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/trips'));
    const acceptCall = fetchMock.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('/api/invitations/accept'),
    );
    expect(acceptCall).toBeFalsy();
  });

  it('login OK but accept fails: still redirects to /trips with toast hint (graceful)', async () => {
    stubByRoute([
      { match: /\/api\/public-config/, status: 200, body: {} },
      { match: /\/api\/oauth\/login(?!\/google)/, status: 200, body: { ok: true } },
      { match: /\/api\/invitations\/accept/, status: 410, body: { error: { code: 'INVITATION_EXPIRED', message: '已過期' } } },
    ]);
    vi.useRealTimers();

    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: 'about:blank' },
      writable: true,
    });

    renderAt('invitation=expired-tok');
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'u@x.com' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'goodpass' } });
    fireEvent.click(screen.getByTestId('login-submit'));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/trips'));
  });
});
