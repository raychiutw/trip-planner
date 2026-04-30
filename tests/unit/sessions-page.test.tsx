/**
 * SessionsPage unit test — V2-P6 multi-device session management UI
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Bypass V2 auth gate — page is rendered as if user is logged in
vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '' },
    reload: () => {},
  }),
}));
// Mock useCurrentUser too — DesktopSidebarConnected (now wrapping the page in
// AppShell) reads from it, and would otherwise consume the stubbed fetch
// Response body before the page-level fetch could read it.
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '' },
    reload: () => {},
  }),
}));

import SessionsPage from '../../src/pages/SessionsPage';

const NOW = new Date('2026-04-25T12:00:00Z').getTime();

const SAMPLE_SESSIONS = [
  {
    sid: 'sess_current',
    ua_summary: 'Chrome on macOS',
    ip_hash_prefix: 'a1b2c3',
    created_at: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    last_seen_at: new Date(NOW - 30 * 1000).toISOString(), // 30s ago → "剛才"
    is_current: true,
  },
  {
    sid: 'sess_phone',
    ua_summary: 'Safari on iOS',
    ip_hash_prefix: 'd4e5f6',
    created_at: new Date(NOW - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    last_seen_at: new Date(NOW - 3 * 60 * 60 * 1000).toISOString(), // 3h ago
    is_current: false,
  },
  {
    sid: 'sess_old',
    ua_summary: null,
    ip_hash_prefix: null,
    created_at: new Date(NOW - 7 * 24 * 60 * 60 * 1000).toISOString(),
    last_seen_at: new Date(NOW - 5 * 24 * 60 * 60 * 1000).toISOString(),
    is_current: false,
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

describe('SessionsPage', () => {
  it('shows loading initially', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    expect(screen.getByTestId('sessions-loading')).toBeTruthy();
  });

  it('renders empty state when no sessions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sessions: [] }), { status: 200 }),
    ));
    vi.useRealTimers();

    render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('sessions-empty')).toBeTruthy());
    expect(screen.getByText(/目前沒有登入裝置紀錄/)).toBeTruthy();
  });

  it('renders sessions list with current pill', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sessions: SAMPLE_SESSIONS }), { status: 200 }),
    ));
    vi.useRealTimers();

    render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('sessions-row-sess_current')).toBeTruthy());
    expect(screen.getByTestId('sessions-row-sess_phone')).toBeTruthy();
    expect(screen.getByTestId('sessions-row-sess_old')).toBeTruthy();
    expect(screen.getByText('Chrome on macOS')).toBeTruthy();
    expect(screen.getByText('Safari on iOS')).toBeTruthy();
    // ua_summary === null → "未知裝置"
    expect(screen.getByText('未知裝置')).toBeTruthy();
    // current pill
    expect(screen.getByText('目前')).toBeTruthy();
  });

  it('current session has no revoke button; non-current does', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sessions: SAMPLE_SESSIONS }), { status: 200 }),
    ));
    vi.useRealTimers();

    render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('sessions-row-sess_current')).toBeTruthy());
    expect(screen.queryByTestId('sessions-revoke-sess_current')).toBeNull();
    expect(screen.queryByTestId('sessions-revoke-sess_phone')).toBeTruthy();
    expect(screen.queryByTestId('sessions-revoke-sess_old')).toBeTruthy();
  });

  it('shows 「登出其他全部裝置」 button only when other sessions exist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sessions: SAMPLE_SESSIONS }), { status: 200 }),
    ));
    vi.useRealTimers();

    render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('sessions-revoke-all')).toBeTruthy());
  });

  it('hides 「登出其他全部裝置」 when only current session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sessions: [SAMPLE_SESSIONS[0]!] }), { status: 200 }),
    ));
    vi.useRealTimers();

    render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('sessions-row-sess_current')).toBeTruthy());
    expect(screen.queryByTestId('sessions-revoke-all')).toBeNull();
  });

  it('Revoke single session → DELETE + remove from list', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ sessions: SAMPLE_SESSIONS }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('sessions-revoke-sess_phone')).toBeTruthy());
    fireEvent.click(screen.getByTestId('sessions-revoke-sess_phone'));

    await waitFor(() => expect(screen.queryByTestId('sessions-row-sess_phone')).toBeNull());
    // current + sess_old still there
    expect(screen.queryByTestId('sessions-row-sess_current')).toBeTruthy();
    expect(screen.queryByTestId('sessions-row-sess_old')).toBeTruthy();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const deleteCall = fetchMock.mock.calls[1]!;
    expect(deleteCall[0]).toBe('/api/account/sessions/sess_phone');
    expect((deleteCall[1] as RequestInit).method).toBe('DELETE');
  });

  it('「登出其他全部裝置」 confirmed via ConfirmModal → DELETE + filter to current only', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ sessions: SAMPLE_SESSIONS }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, revoked_count: 2 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('sessions-revoke-all')).toBeTruthy());
    // Click 觸發 → 開 ConfirmModal（不直接 DELETE）
    fireEvent.click(screen.getByTestId('sessions-revoke-all'));
    await waitFor(() => expect(screen.queryByTestId('confirm-modal')).toBeTruthy());
    // Click ConfirmModal 內的「登出全部」 → 真的 DELETE
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));

    await waitFor(() => expect(screen.queryByTestId('sessions-row-sess_phone')).toBeNull());
    expect(screen.queryByTestId('sessions-row-sess_old')).toBeNull();
    // current remains
    expect(screen.queryByTestId('sessions-row-sess_current')).toBeTruthy();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const deleteCall = fetchMock.mock.calls[1]!;
    expect(deleteCall[0]).toBe('/api/account/sessions');
    expect((deleteCall[1] as RequestInit).method).toBe('DELETE');
  });

  it('「登出其他全部裝置」 ConfirmModal cancel → no DELETE call', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sessions: SAMPLE_SESSIONS }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('sessions-revoke-all')).toBeTruthy());
    fireEvent.click(screen.getByTestId('sessions-revoke-all'));
    await waitFor(() => expect(screen.queryByTestId('confirm-modal')).toBeTruthy());
    fireEvent.click(screen.getByTestId('confirm-modal-cancel'));

    // No additional fetch beyond initial GET
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // All rows still present
    expect(screen.queryByTestId('sessions-row-sess_phone')).toBeTruthy();
    expect(screen.queryByTestId('sessions-row-sess_old')).toBeTruthy();
  });

  it('GET fail → error banner', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    vi.useRealTimers();

    render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('sessions-error')).toBeTruthy());
  });

  it('GET non-200 → error banner', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));
    vi.useRealTimers();

    render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('sessions-error')).toBeTruthy());
  });

  it('Revoke fail → keeps row + shows error', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ sessions: SAMPLE_SESSIONS }), { status: 200 }))
      .mockResolvedValueOnce(new Response('forbidden', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('sessions-revoke-sess_phone')).toBeTruthy());
    fireEvent.click(screen.getByTestId('sessions-revoke-sess_phone'));

    await waitFor(() => expect(screen.queryByTestId('sessions-error')).toBeTruthy());
    // Row still there because DELETE failed
    expect(screen.queryByTestId('sessions-row-sess_phone')).toBeTruthy();
  });

  it('encodes sid in DELETE URL (path injection defence)', async () => {
    const trickySession = {
      ...SAMPLE_SESSIONS[1]!,
      sid: 'sess/x?y=1',
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        sessions: [SAMPLE_SESSIONS[0]!, trickySession],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('sessions-revoke-sess/x?y=1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('sessions-revoke-sess/x?y=1'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const url = fetchMock.mock.calls[1]![0] as string;
    expect(url).toBe('/api/account/sessions/sess%2Fx%3Fy%3D1');
  });
});
