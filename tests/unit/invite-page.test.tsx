/**
 * InvitePage unit test — V2 共編邀請接受 UI
 *
 * 三種狀態 + 兩種 logged-in/anonymous 維度：
 *   - Loading
 *   - Logged-in + email match → 「接受」 button → POST /api/invitations/accept → redirect
 *   - Logged-in + email mismatch → 顯示「此邀請不屬於你的帳號」
 *   - Anonymous → 兩個 CTA「登入並加入」/「註冊並加入」(含 invitation token in query)
 *   - Token invalid / expired / accepted → error 文案 + 「請聯絡邀請者重寄」
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InvitePage from '../../src/pages/InvitePage';

const VALID_INVITATION = {
  tripId: 'trip-1',
  tripTitle: '沖繩 5 日',
  invitedEmail: 'invitee@x.com',
  inviterDisplayName: 'Ray',
  inviterEmail: 'ray@x.com',
  expiresAt: '2026-05-04T00:00:00Z',
};

const LOGGED_IN_USER = {
  id: 'u-1',
  email: 'invitee@x.com',
  emailVerified: true,
  displayName: 'Invitee',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
};

function renderInvite(token = 'abc') {
  return render(
    <MemoryRouter initialEntries={[`/invite?token=${token}`]}>
      <InvitePage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Mock fetch returning routes by URL pattern */
function stubFetch(routes: Array<{ match: RegExp; status: number; body: unknown }>) {
  const fn = vi.fn().mockImplementation((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    const match = routes.find((r) => r.match.test(url));
    if (!match) return Promise.resolve(new Response('Not Found', { status: 404 }));
    return Promise.resolve(
      new Response(JSON.stringify(match.body), {
        status: match.status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('InvitePage', () => {
  it('shows loading state initially', () => {
    stubFetch([
      { match: /\/api\/invitations\?token/, status: 200, body: VALID_INVITATION },
      { match: /\/api\/oauth\/userinfo/, status: 200, body: LOGGED_IN_USER },
    ]);
    renderInvite('valid-token');
    expect(screen.getByText(/載入中/)).toBeTruthy();
  });

  it('logged-in + email match: shows trip preview + accept button', async () => {
    stubFetch([
      { match: /\/api\/invitations\?token/, status: 200, body: VALID_INVITATION },
      { match: /\/api\/oauth\/userinfo/, status: 200, body: LOGGED_IN_USER },
    ]);
    renderInvite('valid-token');
    await waitFor(() => screen.getByTestId('invite-accept-btn'));
    expect(screen.getByText(/沖繩 5 日/)).toBeTruthy();
    expect(screen.getByText(/Ray/)).toBeTruthy();
    expect(screen.getByTestId('invite-accept-btn').textContent).toContain('接受');
  });

  it('clicking accept calls POST /api/invitations/accept + redirects', async () => {
    const fetchFn = stubFetch([
      { match: /\/api\/invitations\?token/, status: 200, body: VALID_INVITATION },
      { match: /\/api\/oauth\/userinfo/, status: 200, body: LOGGED_IN_USER },
      {
        match: /\/api\/invitations\/accept/,
        status: 200,
        body: { ok: true, tripId: 'trip-1', tripTitle: '沖繩 5 日' },
      },
    ]);
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: 'about:blank', assign: vi.fn() },
      writable: true,
    });

    renderInvite('valid-token');
    await waitFor(() => screen.getByTestId('invite-accept-btn'));
    fireEvent.click(screen.getByTestId('invite-accept-btn'));

    await waitFor(() => {
      const acceptCall = fetchFn.mock.calls.find(
        (c) => typeof c[0] === 'string' && (c[0] as string).includes('/api/invitations/accept'),
      );
      expect(acceptCall).toBeTruthy();
    });
    // POST body 含 token
    const acceptCall = fetchFn.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('/api/invitations/accept'),
    );
    const init = acceptCall![1] as RequestInit;
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as { token: string };
    expect(body.token).toBe('valid-token');
  });

  it('logged-in + email mismatch: shows mismatch error', async () => {
    stubFetch([
      { match: /\/api\/invitations\?token/, status: 200, body: VALID_INVITATION },
      {
        match: /\/api\/oauth\/userinfo/,
        status: 200,
        body: { ...LOGGED_IN_USER, email: 'someone-else@x.com' },
      },
    ]);
    renderInvite('valid-token');
    await waitFor(() => expect(screen.queryByText(/不屬於你/)).toBeTruthy());
  });

  it('anonymous: shows login + signup CTAs with invitation token in query', async () => {
    stubFetch([
      { match: /\/api\/invitations\?token/, status: 200, body: VALID_INVITATION },
      { match: /\/api\/oauth\/userinfo/, status: 401, body: { error: 'unauth' } },
    ]);
    renderInvite('the-token');
    await waitFor(() => screen.getByTestId('invite-login-btn'));
    const loginLink = screen.getByTestId('invite-login-btn') as HTMLAnchorElement;
    const signupLink = screen.getByTestId('invite-signup-btn') as HTMLAnchorElement;
    expect(loginLink.getAttribute('href')).toContain('/login');
    expect(loginLink.getAttribute('href')).toContain('invitation=the-token');
    expect(signupLink.getAttribute('href')).toContain('/signup');
    expect(signupLink.getAttribute('href')).toContain('invitation=the-token');
  });

  it('expired invitation: shows expiry message + 重寄 hint', async () => {
    stubFetch([
      {
        match: /\/api\/invitations\?token/,
        status: 410,
        body: { error: { code: 'INVITATION_EXPIRED', message: '已過期' } },
      },
      { match: /\/api\/oauth\/userinfo/, status: 401, body: { error: 'unauth' } },
    ]);
    renderInvite('expired');
    await waitFor(() => expect(screen.queryByText(/過期/)).toBeTruthy());
    expect(screen.getByText(/重寄/)).toBeTruthy();
  });

  it('invalid invitation: shows invalid message', async () => {
    stubFetch([
      {
        match: /\/api\/invitations\?token/,
        status: 410,
        body: { error: { code: 'INVITATION_INVALID', message: '無效' } },
      },
      { match: /\/api\/oauth\/userinfo/, status: 401, body: { error: 'unauth' } },
    ]);
    renderInvite('bad');
    await waitFor(() => expect(screen.queryByText(/無效/)).toBeTruthy());
  });

  it('missing token query param: shows error', () => {
    stubFetch([
      { match: /\/api\/oauth\/userinfo/, status: 401, body: { error: 'unauth' } },
    ]);
    render(
      <MemoryRouter initialEntries={['/invite']}>
        <InvitePage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/缺少|無效/)).toBeTruthy();
  });
});
