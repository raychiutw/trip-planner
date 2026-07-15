/**
 * ConnectedAppsPage unit test — V2-P5
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Bypass V2 auth gate — page is rendered as if user is logged in
vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '' }, reload: () => {} }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '' }, reload: () => {} }),
}));

import ConnectedAppsPage from '../../src/pages/ConnectedAppsPage';

const SAMPLE_APPS = [
  {
    client_id: 'tp_abc',
    app_name: 'Trip Buddy',
    app_logo_url: null,
    app_description: 'Travel app',
    homepage_url: 'https://example.com',
    status: 'active',
    scopes: ['openid', 'profile', 'trips.read'],
    granted_at: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
  },
  {
    client_id: 'tp_xyz',
    app_name: 'MapMate',
    app_logo_url: null,
    app_description: null,
    homepage_url: null,
    status: 'active',
    scopes: ['openid'],
    granted_at: Date.now() - 60 * 60 * 1000, // 1h ago
  },
];

// URL-aware fetch stub：ConnectedAppsPage 現在含 <AiAuthorizeCard/>，mount 會多打一個
// GET /account/ai-authorization。用路由式 mock 讓斷言不依賴呼叫順序/次數。
function routedFetch(opts: { apps?: unknown[]; authorized?: boolean } = {}) {
  const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/account/ai-authorization')) {
      return Promise.resolve(new Response(JSON.stringify({ authorized: opts.authorized ?? false }), { status: 200 }));
    }
    if (init?.method === 'DELETE') {
      return Promise.resolve(new Response(JSON.stringify({ ok: true, revoked_client_id: 'x' }), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ apps: opts.apps ?? [] }), { status: 200 }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
function deleteCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((c: unknown[]) => (c[1] as RequestInit | undefined)?.method === 'DELETE');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-25T12:00:00Z'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('ConnectedAppsPage', () => {
  it('shows loading initially', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<MemoryRouter><ConnectedAppsPage /></MemoryRouter>);
    expect(screen.getByTestId('connected-apps-loading')).toBeTruthy();
  });

  it('renders empty state when no apps', async () => {
    routedFetch({ apps: [] });
    vi.useRealTimers();

    render(<MemoryRouter><ConnectedAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('connected-apps-empty')).toBeTruthy());
    expect(screen.getByText(/還沒有任何應用/)).toBeTruthy();
  });

  it('renders apps list with name + scopes', async () => {
    routedFetch({ apps: SAMPLE_APPS });
    vi.useRealTimers();

    render(<MemoryRouter><ConnectedAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('connected-apps-row-tp_abc')).toBeTruthy());
    expect(screen.getByText('Trip Buddy')).toBeTruthy();
    expect(screen.getByText('MapMate')).toBeTruthy();
    expect(screen.getAllByText('openid').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('trips.read')).toBeTruthy();
  });

  it('Revoke button → opens confirm modal (二次確認)', async () => {
    routedFetch({ apps: SAMPLE_APPS });
    vi.useRealTimers();

    render(<MemoryRouter><ConnectedAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('connected-apps-revoke-tp_abc')).toBeTruthy());
    fireEvent.click(screen.getByTestId('connected-apps-revoke-tp_abc'));
    expect(screen.getByTestId('confirm-modal')).toBeTruthy();
    expect(screen.getByText(/撤銷 Trip Buddy/)).toBeTruthy();
  });

  it('Cancel modal → no DELETE call', async () => {
    const fetchMock = routedFetch({ apps: SAMPLE_APPS });
    vi.useRealTimers();

    render(<MemoryRouter><ConnectedAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('connected-apps-revoke-tp_abc')).toBeTruthy());
    fireEvent.click(screen.getByTestId('connected-apps-revoke-tp_abc'));
    fireEvent.click(screen.getByTestId('confirm-modal-cancel'));

    // Modal closed
    expect(screen.queryByTestId('confirm-modal')).toBeNull();
    // 無 DELETE（不依賴總呼叫次數 — AiAuthorizeCard 另有一個 GET）
    expect(deleteCalls(fetchMock)).toHaveLength(0);
  });

  it('Confirm revoke → DELETE + remove from list', async () => {
    const fetchMock = routedFetch({ apps: SAMPLE_APPS });
    vi.useRealTimers();

    render(<MemoryRouter><ConnectedAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('connected-apps-revoke-tp_abc')).toBeTruthy());
    fireEvent.click(screen.getByTestId('connected-apps-revoke-tp_abc'));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));

    await waitFor(() => expect(screen.queryByTestId('connected-apps-row-tp_abc')).toBeNull());
    // tp_xyz still there
    expect(screen.queryByTestId('connected-apps-row-tp_xyz')).toBeTruthy();

    const del = deleteCalls(fetchMock);
    expect(del).toHaveLength(1);
    expect(del[0]![0]).toBe('/api/account/connected-apps/tp_abc');
    expect((del[0]![1] as RequestInit).method).toBe('DELETE');
  });

  it('顯示 Tripline AI 排程授權入口卡（未授權 → 授權鈕）', async () => {
    routedFetch({ apps: [], authorized: false });
    vi.useRealTimers();

    render(<MemoryRouter><ConnectedAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('ai-authorize-btn')).toBeTruthy());
  });

  it('GET fail → error banner', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    vi.useRealTimers();

    render(<MemoryRouter><ConnectedAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('connected-apps-error')).toBeTruthy());
  });

  it('encodes client_id in DELETE URL (防 path injection)', async () => {
    const trickyApp = {
      ...SAMPLE_APPS[0]!,
      client_id: 'tp_a/b?c=1',
    };
    const fetchMock = routedFetch({ apps: [trickyApp] });
    vi.useRealTimers();

    render(<MemoryRouter><ConnectedAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('connected-apps-revoke-tp_a/b?c=1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('connected-apps-revoke-tp_a/b?c=1'));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));

    await waitFor(() => expect(deleteCalls(fetchMock).length).toBe(1));
    const url = deleteCalls(fetchMock)[0]![0] as string;
    expect(url).toBe('/api/account/connected-apps/tp_a%2Fb%3Fc%3D1');
  });
});
