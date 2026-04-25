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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ apps: [] }), { status: 200 }),
    ));
    vi.useRealTimers();

    render(<MemoryRouter><ConnectedAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('connected-apps-empty')).toBeTruthy());
    expect(screen.getByText(/還沒有任何應用/)).toBeTruthy();
  });

  it('renders apps list with name + scopes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ apps: SAMPLE_APPS }), { status: 200 }),
    ));
    vi.useRealTimers();

    render(<MemoryRouter><ConnectedAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('connected-apps-row-tp_abc')).toBeTruthy());
    expect(screen.getByText('Trip Buddy')).toBeTruthy();
    expect(screen.getByText('MapMate')).toBeTruthy();
    expect(screen.getAllByText('openid').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('trips.read')).toBeTruthy();
  });

  it('Revoke button → opens confirm modal (二次確認)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ apps: SAMPLE_APPS }), { status: 200 }),
    ));
    vi.useRealTimers();

    render(<MemoryRouter><ConnectedAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('connected-apps-revoke-tp_abc')).toBeTruthy());
    fireEvent.click(screen.getByTestId('connected-apps-revoke-tp_abc'));
    expect(screen.getByTestId('connected-apps-confirm-modal')).toBeTruthy();
    expect(screen.getByText(/撤銷 Trip Buddy/)).toBeTruthy();
  });

  it('Cancel modal → no DELETE call', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ apps: SAMPLE_APPS }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(<MemoryRouter><ConnectedAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('connected-apps-revoke-tp_abc')).toBeTruthy());
    fireEvent.click(screen.getByTestId('connected-apps-revoke-tp_abc'));
    fireEvent.click(screen.getByTestId('connected-apps-cancel-revoke'));

    // Modal closed
    expect(screen.queryByTestId('connected-apps-confirm-modal')).toBeNull();
    // Only initial GET, no DELETE
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Confirm revoke → DELETE + remove from list', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ apps: SAMPLE_APPS }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, revoked_client_id: 'tp_abc' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(<MemoryRouter><ConnectedAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('connected-apps-revoke-tp_abc')).toBeTruthy());
    fireEvent.click(screen.getByTestId('connected-apps-revoke-tp_abc'));
    fireEvent.click(screen.getByTestId('connected-apps-confirm-revoke'));

    await waitFor(() => expect(screen.queryByTestId('connected-apps-row-tp_abc')).toBeNull());
    // tp_xyz still there
    expect(screen.queryByTestId('connected-apps-row-tp_xyz')).toBeTruthy();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const deleteCall = fetchMock.mock.calls[1]!;
    expect(deleteCall[0]).toBe('/api/account/connected-apps/tp_abc');
    expect((deleteCall[1] as RequestInit).method).toBe('DELETE');
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
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ apps: [trickyApp] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(<MemoryRouter><ConnectedAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('connected-apps-revoke-tp_a/b?c=1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('connected-apps-revoke-tp_a/b?c=1'));
    fireEvent.click(screen.getByTestId('connected-apps-confirm-revoke'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const url = fetchMock.mock.calls[1]![0] as string;
    expect(url).toBe('/api/account/connected-apps/tp_a%2Fb%3Fc%3D1');
  });
});
