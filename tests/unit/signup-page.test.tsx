/**
 * SignupPage unit test — V2-P2
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignupPage from '../../src/pages/SignupPage';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function fillForm({ email, password, name }: { email?: string; password?: string; name?: string }) {
  if (email !== undefined) {
    fireEvent.change(screen.getByTestId('signup-email'), { target: { value: email } });
  }
  if (password !== undefined) {
    fireEvent.change(screen.getByTestId('signup-password'), { target: { value: password } });
  }
  if (name !== undefined) {
    fireEvent.change(screen.getByTestId('signup-display-name'), { target: { value: name } });
  }
}

beforeEach(() => {
  navigateMock.mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-25T00:00:00Z'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('SignupPage', () => {
  it('renders form fields', () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('signup-email')).toBeTruthy();
    expect(screen.getByTestId('signup-password')).toBeTruthy();
    expect(screen.getByTestId('signup-display-name')).toBeTruthy();
    expect(screen.getByTestId('signup-submit')).toBeTruthy();
  });

  it('successful signup → navigates to /signup/check-email + sends verification', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ ok: true, userId: 'u1', email: 'new@example.com', requiresVerification: true }),
        { status: 201 },
      ))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, message: 'sent' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    fillForm({ email: 'new@example.com', password: 'longpassword123', name: 'New' });
    fireEvent.click(screen.getByTestId('signup-submit'));

    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(navigateMock.mock.calls[0]![0]).toBe('/signup/check-email?email=new%40example.com');

    // Verify both endpoints called
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/oauth/signup');
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/oauth/send-verification');
  });

  it('SIGNUP_INVALID_EMAIL → inline email error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'SIGNUP_INVALID_EMAIL', message: 'bad' } }),
        { status: 400 },
      ),
    ));
    vi.useRealTimers();

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );
    fillForm({ email: 'bad', password: 'longenough' });
    fireEvent.click(screen.getByTestId('signup-submit'));

    await waitFor(() => expect(screen.getByTestId('signup-email-error')).toBeTruthy());
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('SIGNUP_EMAIL_TAKEN → banner with login + forgot links', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'SIGNUP_EMAIL_TAKEN', message: 'taken' } }),
        { status: 409 },
      ),
    ));
    vi.useRealTimers();

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );
    fillForm({ email: 'taken@x.com', password: 'longenough' });
    fireEvent.click(screen.getByTestId('signup-submit'));

    await waitFor(() => expect(screen.getByTestId('signup-banner-error')).toBeTruthy());
    const banner = screen.getByTestId('signup-banner-error');
    expect(banner.textContent).toContain('已註冊');
    expect(banner.querySelector('a[href="/login"]')).toBeTruthy();
    expect(banner.querySelector('a[href="/login/forgot"]')).toBeTruthy();
  });

  it('SIGNUP_RATE_LIMITED → warning banner with retry-after', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'SIGNUP_RATE_LIMITED', message: 'too many' } }),
        { status: 429, headers: { 'Retry-After': '300' } },
      ),
    ));
    vi.useRealTimers();

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );
    fillForm({ email: 'x@y.com', password: 'longenough' });
    fireEvent.click(screen.getByTestId('signup-submit'));

    await waitFor(() => expect(screen.getByTestId('signup-banner-warning')).toBeTruthy());
    expect(screen.getByTestId('signup-banner-warning').textContent).toContain('300');
  });

  it('Network failure → generic error banner', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    vi.useRealTimers();

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );
    fillForm({ email: 'x@y.com', password: 'longenough' });
    fireEvent.click(screen.getByTestId('signup-submit'));

    await waitFor(() => expect(screen.getByTestId('signup-banner-error')).toBeTruthy());
    expect(screen.getByTestId('signup-banner-error').textContent).toContain('網路');
  });

  it('Submit button disabled while submitting', async () => {
    let resolve: (v: Response) => void;
    const promise = new Promise<Response>((r) => { resolve = r; });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(promise));
    vi.useRealTimers();

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );
    fillForm({ email: 'x@y.com', password: 'longenough' });
    const btn = screen.getByTestId('signup-submit') as HTMLButtonElement;
    fireEvent.click(btn);

    await waitFor(() => expect(btn.disabled).toBe(true));
    resolve!(new Response(JSON.stringify({ ok: true, userId: 'u', email: 'x@y.com', requiresVerification: true }), { status: 201 }));
  });
});

describe('SignupPage with ?invitation=token (V2 共編)', () => {
  it('passes invitationToken to /api/oauth/signup body', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true, userId: 'u', email: 'new@x.com', requiresVerification: true,
        joinedTrip: null, invitationError: null,
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(
      <MemoryRouter initialEntries={['/signup?invitation=tok-xyz']}>
        <SignupPage />
      </MemoryRouter>,
    );
    fillForm({ email: 'new@x.com', password: 'longenough' });
    fireEvent.click(screen.getByTestId('signup-submit'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const signupCall = fetchMock.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string) === '/api/oauth/signup',
    )!;
    const body = JSON.parse((signupCall[1] as RequestInit).body as string) as {
      invitationToken: string;
    };
    expect(body.invitationToken).toBe('tok-xyz');
  });

  it('joinedTrip in response → redirects to /trips?selected=tripId (not /signup/check-email)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true, userId: 'u', email: 'new@x.com', requiresVerification: true,
        joinedTrip: { id: 'trip-1', title: '沖繩' },
        invitationError: null,
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(
      <MemoryRouter initialEntries={['/signup?invitation=tok']}>
        <SignupPage />
      </MemoryRouter>,
    );
    fillForm({ email: 'new@x.com', password: 'longenough' });
    fireEvent.click(screen.getByTestId('signup-submit'));

    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(navigateMock.mock.calls[0]![0]).toBe('/trips?selected=trip-1');
  });

  it('joinedTrip null but invitationError set → still goes to /signup/check-email (signup OK, invite failed silently)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true, userId: 'u', email: 'new@x.com', requiresVerification: true,
        joinedTrip: null, invitationError: 'INVITATION_EXPIRED',
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(
      <MemoryRouter initialEntries={['/signup?invitation=expired-tok']}>
        <SignupPage />
      </MemoryRouter>,
    );
    fillForm({ email: 'new@x.com', password: 'longenough' });
    fireEvent.click(screen.getByTestId('signup-submit'));

    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    // 仍走 check-email flow (signup 成功)，但 query 加 invitationError 給 toast
    const navTo = navigateMock.mock.calls[0]![0] as string;
    expect(navTo).toContain('/signup/check-email');
    expect(navTo).toContain('invitationError=INVITATION_EXPIRED');
  });
});
