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
    expect(screen.getByRole('button', { name: '建立新應用' }).getAttribute('title')).toBe('建立新應用');
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

  it('GET fail → content PageErrorState with retry and back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    vi.useRealTimers();

    render(<MemoryRouter><DeveloperAppsPage /></MemoryRouter>);
    const error = await screen.findByTestId('dev-apps-error');
    expect(error.getAttribute('role')).toBe('alert');
    expect(error.closest('[data-testid="dev-apps-content"]')).toBeTruthy();
    expect(error.querySelector('button')?.textContent).toBe('重試');
    expect(screen.getByRole('button', { name: '返回帳號' })).toBeTruthy();
  });

  it('500 後可用原 TitleBar action 重試，成功後顯示真實列表', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'SYS_ERROR', message: 'failed' } }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ apps: [SAMPLE_APP] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(<MemoryRouter><DeveloperAppsPage /></MemoryRouter>);
    await screen.findByTestId('dev-apps-error');
    const retry = screen.getByRole('button', { name: '重新載入應用列表' });
    fireEvent.click(retry);

    await waitFor(() => expect(screen.getByTestId('dev-apps-row-tp_abc')).toBeTruthy());
    expect(screen.queryByTestId('dev-apps-error')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('內容重試將焦點移到穩定的 TitleBar action，連按不會意外前往建立表單', async () => {
    let resolveRetry!: (response: Response) => void;
    const retryResponse = new Promise<Response>((resolve) => { resolveRetry = resolve; });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'SYS_ERROR', message: 'failed' } }), { status: 500 }))
      .mockReturnValueOnce(retryResponse));
    vi.useRealTimers();

    render(
      <MemoryRouter initialEntries={['/developer/apps']}>
        <Routes>
          <Route path="/developer/apps" element={<DeveloperAppsPage />} />
          <Route path="/developer/apps/new" element={<div data-testid="new-page-stub">NEW PAGE</div>} />
        </Routes>
      </MemoryRouter>,
    );
    const error = await screen.findByTestId('dev-apps-error');
    const retry = error.querySelector('button')!;
    retry.focus();
    fireEvent.click(retry);
    const busyAction = screen.getByRole('button', { name: '載入中…' });
    expect(document.activeElement).toBe(busyAction);
    fireEvent.click(busyAction);
    expect(screen.queryByTestId('new-page-stub')).toBeNull();

    await act(async () => { resolveRetry(new Response(JSON.stringify({ apps: [SAMPLE_APP] }), { status: 200 })); await retryResponse; });
    await waitFor(() => expect(screen.getByTestId('dev-apps-row-tp_abc')).toBeTruthy());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '建立新應用' }));
  });

  it('403 明確告知無權並提供返回帳號，不引導建立應用', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: 'AUTH_FORBIDDEN', message: 'forbidden' } }), { status: 403 },
    )));
    vi.useRealTimers();

    render(
      <MemoryRouter initialEntries={['/developer/apps']}>
        <Routes>
          <Route path="/developer/apps" element={<DeveloperAppsPage />} />
          <Route path="/account" element={<div data-testid="account-stub">ACCOUNT</div>} />
        </Routes>
      </MemoryRouter>,
    );
    const error = await screen.findByTestId('dev-apps-error');
    expect(error.textContent).toMatch(/沒有權限/);
    expect(error.closest('[data-testid="dev-apps-content"]')).toBeNull();
    expect(error.compareDocumentPosition(screen.getByTestId('dev-apps-content')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId('dev-apps-empty')).toBeNull();
    expect(screen.queryByRole('button', { name: '建立新應用' })).toBeNull();
    expect(screen.getByTestId('titlebar').querySelectorAll('button')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('titlebar').querySelector('button')!);
    await waitFor(() => expect(screen.getByTestId('account-stub')).toBeTruthy());
  });

  it('列表載入後若權限被撤銷，舊列表不留在無權畫面', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ apps: [SAMPLE_APP] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'AUTH_FORBIDDEN', message: 'forbidden' } }), { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(<MemoryRouter><DeveloperAppsPage /></MemoryRouter>);
    await screen.findByTestId('dev-apps-row-tp_abc');
    act(() => window.dispatchEvent(new CustomEvent('tp-developer-app-created')));
    await screen.findByTestId('dev-apps-error');

    expect(screen.queryByTestId('dev-apps-row-tp_abc')).toBeNull();
    expect(screen.getByTestId('dev-apps-error').textContent).toMatch(/沒有權限/);
  });
});
