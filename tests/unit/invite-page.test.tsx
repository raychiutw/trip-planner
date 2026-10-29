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
import { MemoryRouter, useNavigate } from 'react-router-dom';
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
    expect(screen.getByText(/共編成員/)).toBeTruthy();
  });

  it('shows the invitation role supplied by the trip', async () => {
    stubFetch([
      { match: /\/api\/invitations\?token/, status: 200, body: { ...VALID_INVITATION, role: 'viewer' } },
      { match: /\/api\/oauth\/userinfo/, status: 200, body: LOGGED_IN_USER },
    ]);
    renderInvite('viewer-token');
    await waitFor(() => screen.getByTestId('invite-accept-btn'));
    expect(screen.getByText(/檢視成員/)).toBeTruthy();
    expect(screen.queryByText(/共編成員/)).toBeNull();
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

  it('temporary accept failure keeps the original invitation available to retry', async () => {
    const fetchFn = stubFetch([
      { match: /\/api\/invitations\?token/, status: 200, body: VALID_INVITATION },
      { match: /\/api\/oauth\/userinfo/, status: 200, body: LOGGED_IN_USER },
      { match: /\/api\/invitations\/accept/, status: 503, body: { error: { code: 'SYS_DB_ERROR', message: '資料庫暫時無法使用' } } },
    ]);
    renderInvite('same-token');
    await waitFor(() => screen.getByTestId('invite-accept-btn'));
    fireEvent.click(screen.getByTestId('invite-accept-btn'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('網路錯誤'));
    expect(screen.getByTestId('invite-accept-btn').hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByTestId('invite-accept-btn'));
    await waitFor(() => expect(fetchFn.mock.calls.filter(([url]) => String(url).includes('/invitations/accept'))).toHaveLength(2));
    for (const [, init] of fetchFn.mock.calls.filter(([url]) => String(url).includes('/invitations/accept'))) {
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({ token: 'same-token' });
    }
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
    expect((screen.getByTestId('invite-switch-account') as HTMLAnchorElement).getAttribute('href'))
      .toBe('/api/oauth/logout?redirect_after=%2Flogin%3Finvitation%3Dvalid-token');
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
    expect(screen.getByText(/invitee@x.com/)).toBeTruthy();
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

  it('already accepted invitation has its own result', async () => {
    stubFetch([
      { match: /\/api\/invitations\?token/, status: 410, body: { error: { code: 'INVITATION_ACCEPTED', message: '此邀請已接受過' } } },
      { match: /\/api\/oauth\/userinfo/, status: 401, body: {} },
    ]);
    renderInvite('used');
    await waitFor(() => expect(screen.getByTestId('invite-error').textContent).toContain('已接受'));
    expect(screen.queryByText(/重寄/)).toBeNull();
  });

  it('temporary preview failure retries the same invitation', async () => {
    const fetchFn = vi.fn()
      .mockImplementation((input: string) => {
        if (input.includes('/oauth/userinfo')) return Promise.resolve(new Response('{}', { status: 401 }));
        const attempts = fetchFn.mock.calls.filter(([url]) => String(url).includes('/invitations?token')).length;
        return Promise.resolve(attempts === 1
          ? new Response('', { status: 503 })
          : new Response(JSON.stringify(VALID_INVITATION), { status: 200, headers: { 'content-type': 'application/json' } }));
      });
    vi.stubGlobal('fetch', fetchFn);
    renderInvite('retry-token');
    await waitFor(() => screen.getByTestId('invite-retry'));
    expect(screen.getByTestId('invite-error').textContent).toContain('無法載入');
    expect(screen.queryByText(/重寄/)).toBeNull();
    fireEvent.click(screen.getByTestId('invite-retry'));
    await waitFor(() => expect(screen.getByText(/沖繩 5 日/)).toBeTruthy());
    const urls = fetchFn.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/invitations?token'));
    expect(urls).toEqual(['/api/invitations?token=retry-token', '/api/invitations?token=retry-token']);
  });

  it('does not accept a previous invitation while the route changes to another token', async () => {
    let resolveSecond!: (value: Response) => void;
    const fetchFn = vi.fn().mockImplementation((input: string) => {
      if (input.includes('/oauth/userinfo')) return Promise.resolve(new Response(JSON.stringify(LOGGED_IN_USER), { status: 200 }));
      if (input.includes('token=second')) return new Promise<Response>((resolve) => { resolveSecond = resolve; });
      return Promise.resolve(new Response(JSON.stringify(VALID_INVITATION), { status: 200, headers: { 'content-type': 'application/json' } }));
    });
    vi.stubGlobal('fetch', fetchFn);
    function SwitchRoute() {
      const navigate = useNavigate();
      return <button onClick={() => navigate('/invite?token=second')}>下一個連結</button>;
    }
    render(<MemoryRouter initialEntries={['/invite?token=first']}><SwitchRoute /><InvitePage /></MemoryRouter>);
    await waitFor(() => screen.getByTestId('invite-accept-btn'));
    fireEvent.click(screen.getByText('下一個連結'));
    expect(screen.queryByTestId('invite-accept-btn')).toBeNull();
    resolveSecond(new Response(JSON.stringify({ ...VALID_INVITATION, tripTitle: '第二個行程' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await waitFor(() => expect(screen.getByText(/第二個行程/)).toBeTruthy());
    expect(fetchFn.mock.calls.some(([url]) => String(url).includes('/invitations/accept'))).toBe(false);
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
