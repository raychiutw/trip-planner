/**
 * DeveloperAppsPage unit test — V2-P4
 *
 * 2026-05-03 modal-to-fullpage migration: create-app modal 已搬到
 * src/pages/DeveloperAppNewPage.tsx (/developer/apps/new)。原 modal flow
 * tests (open/cancel/submit/validation) 移至 developer-app-new-page.test.tsx。
 * 這裡只 cover list page (loading / empty / render / error / navigate)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Bypass V2 auth gate — page is rendered as if user is logged in
vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '' }, reload: () => {} }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '' }, reload: () => {} }),
}));

import DeveloperAppsPage from '../../src/pages/DeveloperAppsPage';

const SAMPLE_APP = {
  client_id: 'tp_abc',
  client_type: 'public' as const,
  app_name: 'Trip Buddy',
  app_description: null,
  homepage_url: null,
  redirect_uris: ['https://example.com/cb'],
  allowed_scopes: ['openid', 'profile'],
  status: 'active' as const,
  created_at: '2026-04-20T00:00:00Z',
  updated_at: '2026-04-20T00:00:00Z',
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-25T00:00:00Z'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('DeveloperAppsPage', () => {
  it('shows loading initially', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<MemoryRouter><DeveloperAppsPage /></MemoryRouter>);
    expect(screen.getByTestId('dev-apps-loading')).toBeTruthy();
  });

  it('renders empty state when no apps', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ apps: [] }), { status: 200 }),
    ));
    vi.useRealTimers();

    render(<MemoryRouter><DeveloperAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('dev-apps-empty')).toBeTruthy());
    expect(screen.getByText(/尚未建立任何應用/)).toBeTruthy();
  });

  it('empty registry keeps a keyboard-focusable path to creating the first app', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ apps: [] }), { status: 200 }),
    ));
    vi.useRealTimers();

    render(
      <MemoryRouter initialEntries={['/developer/apps']}>
        <Routes>
          <Route path="/developer/apps" element={<DeveloperAppsPage />} />
          <Route path="/developer/apps/new" element={<div data-testid="new-page-stub">NEW PAGE</div>} />
        </Routes>
      </MemoryRouter>,
    );
    const create = await screen.findByTestId('dev-apps-empty-cta');
    create.focus();
    expect(document.activeElement).toBe(create);
    fireEvent.click(create);
    await waitFor(() => expect(screen.getByTestId('new-page-stub')).toBeTruthy());
  });

  it('renders apps list with status pill', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ apps: [SAMPLE_APP] }), { status: 200 }),
    ));
    vi.useRealTimers();

    render(<MemoryRouter><DeveloperAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('dev-apps-row-tp_abc')).toBeTruthy());
    expect(screen.getByText('Trip Buddy')).toBeTruthy();
    expect(screen.getByText('tp_abc')).toBeTruthy();
    expect(screen.getByText('使用中')).toBeTruthy();
  });

  it('does not expose a secret even if an API payload includes one', async () => {
    const secret = 'tps-sensitive-secret-value';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ apps: [{ ...SAMPLE_APP, client_secret: secret, client_secret_hash: 'private-hash' }] }), { status: 200 }),
    ));
    vi.useRealTimers();

    render(<MemoryRouter><DeveloperAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('dev-apps-row-tp_abc')).toBeTruthy());
    expect(document.body.textContent).not.toContain(secret);
    expect(document.body.textContent).not.toContain('private-hash');
  });

  it('「建立新應用」 button → navigate 到 /developer/apps/new (不再 mount modal)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ apps: [] }), { status: 200 }),
    ));
    vi.useRealTimers();

    render(
      <MemoryRouter initialEntries={['/developer/apps']}>
        <Routes>
          <Route path="/developer/apps" element={<DeveloperAppsPage />} />
          <Route path="/developer/apps/new" element={<div data-testid="new-page-stub">NEW PAGE</div>} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.queryByTestId('dev-apps-empty')).toBeTruthy());
    fireEvent.click(screen.getByTestId('dev-apps-new'));
    // 1) modal 不再 mount
    expect(screen.queryByTestId('dev-apps-create-modal')).toBeNull();
    // 2) navigate 到 /developer/apps/new (用 stub route 驗 URL transition)
    await waitFor(() => expect(screen.queryByTestId('new-page-stub')).toBeTruthy());
  });

  it('listens to tp-developer-app-created event → refetch list', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ apps: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ apps: [SAMPLE_APP] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(<MemoryRouter><DeveloperAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('dev-apps-empty')).toBeTruthy());

    // Simulate NewPage submit success → ack secret → dispatch event
    window.dispatchEvent(new CustomEvent('tp-developer-app-created'));

    await waitFor(() => expect(screen.queryByTestId('dev-apps-row-tp_abc')).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('an older list response cannot erase an app loaded after a create event', async () => {
    let resolveInitial!: (response: Response) => void;
    const initial = new Promise<Response>((resolve) => { resolveInitial = resolve; });
    const fetchMock = vi.fn()
      .mockReturnValueOnce(initial)
      .mockResolvedValueOnce(new Response(JSON.stringify({ apps: [SAMPLE_APP] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(<MemoryRouter><DeveloperAppsPage /></MemoryRouter>);
    expect(screen.getByTestId('dev-apps-loading')).toBeTruthy();
    act(() => window.dispatchEvent(new CustomEvent('tp-developer-app-created')));
    await waitFor(() => expect(screen.getByTestId('dev-apps-row-tp_abc')).toBeTruthy());

    await act(async () => { resolveInitial(new Response(JSON.stringify({ apps: [] }), { status: 200 })); await initial; });
    expect(screen.getByTestId('dev-apps-row-tp_abc')).toBeTruthy();
    expect(screen.queryByTestId('dev-apps-empty')).toBeNull();
  });

  it('GET fail → error banner', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    vi.useRealTimers();

    render(<MemoryRouter><DeveloperAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('dev-apps-error')).toBeTruthy());
  });
});
