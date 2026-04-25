/**
 * DeveloperAppsPage unit test — V2-P4
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Bypass V2 auth gate — page is rendered as if user is logged in
vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '' }, reload: () => {} }),
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

  it('renders apps list with status pill', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ apps: [SAMPLE_APP] }), { status: 200 }),
    ));
    vi.useRealTimers();

    render(<MemoryRouter><DeveloperAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('dev-apps-row-tp_abc')).toBeTruthy());
    expect(screen.getByText('Trip Buddy')).toBeTruthy();
    expect(screen.getByText('tp_abc')).toBeTruthy();
    expect(screen.getByText('ACTIVE')).toBeTruthy();
  });

  it('「建立新應用」 button → opens create modal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ apps: [] }), { status: 200 }),
    ));
    vi.useRealTimers();

    render(<MemoryRouter><DeveloperAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('dev-apps-empty')).toBeTruthy());
    fireEvent.click(screen.getByTestId('dev-apps-new'));
    expect(screen.getByTestId('dev-apps-create-modal')).toBeTruthy();
  });

  it('Cancel modal → closes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ apps: [] }), { status: 200 }),
    ));
    vi.useRealTimers();

    render(<MemoryRouter><DeveloperAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('dev-apps-new')).toBeTruthy());
    fireEvent.click(screen.getByTestId('dev-apps-new'));
    fireEvent.click(screen.getByTestId('dev-apps-create-cancel'));
    expect(screen.queryByTestId('dev-apps-create-modal')).toBeNull();
  });

  it('Submit valid form → POST + show secret modal with client_secret', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ apps: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          client_id: 'tp_new',
          client_secret: 'tps_secret123',
          app_name: 'New',
          client_type: 'confidential',
          status: 'pending_review',
          redirect_uris: ['https://x.com/cb'],
          allowed_scopes: ['openid'],
        }),
        { status: 201 },
      ))
      .mockResolvedValueOnce(new Response(JSON.stringify({ apps: [] }), { status: 200 })); // refresh
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(<MemoryRouter><DeveloperAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('dev-apps-new')).toBeTruthy());
    fireEvent.click(screen.getByTestId('dev-apps-new'));

    fireEvent.change(screen.getByTestId('dev-apps-name'), { target: { value: 'My App' } });
    fireEvent.change(screen.getByTestId('dev-apps-uris'), { target: { value: 'https://example.com/cb' } });
    fireEvent.click(screen.getByTestId('dev-apps-type-confidential'));
    fireEvent.click(screen.getByTestId('dev-apps-create-submit'));

    await waitFor(() => expect(screen.queryByTestId('dev-apps-secret-modal')).toBeTruthy());
    expect(screen.getByTestId('dev-apps-secret-client-id').textContent).toBe('tp_new');
    expect(screen.getByTestId('dev-apps-secret-client-secret').textContent).toBe('tps_secret123');
    expect(screen.getByText(/不會再顯示/)).toBeTruthy();
  });

  it('Public client → no client_secret in result modal', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ apps: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          client_id: 'tp_pub',
          client_secret: null,
          app_name: 'Public App',
          client_type: 'public',
          status: 'pending_review',
          redirect_uris: ['https://x.com/cb'],
          allowed_scopes: ['openid'],
        }),
        { status: 201 },
      ))
      .mockResolvedValueOnce(new Response(JSON.stringify({ apps: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(<MemoryRouter><DeveloperAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('dev-apps-new')).toBeTruthy());
    fireEvent.click(screen.getByTestId('dev-apps-new'));

    fireEvent.change(screen.getByTestId('dev-apps-name'), { target: { value: 'Pub' } });
    fireEvent.change(screen.getByTestId('dev-apps-uris'), { target: { value: 'https://x.com/cb' } });
    fireEvent.click(screen.getByTestId('dev-apps-create-submit'));

    await waitFor(() => expect(screen.queryByTestId('dev-apps-secret-modal')).toBeTruthy());
    expect(screen.getByTestId('dev-apps-secret-client-id')).toBeTruthy();
    expect(screen.queryByTestId('dev-apps-secret-client-secret')).toBeNull();
  });

  it('Validation: app_name too short → inline error, no POST', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ apps: [] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(<MemoryRouter><DeveloperAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('dev-apps-new')).toBeTruthy());
    fireEvent.click(screen.getByTestId('dev-apps-new'));

    fireEvent.change(screen.getByTestId('dev-apps-name'), { target: { value: 'X' } });
    fireEvent.change(screen.getByTestId('dev-apps-uris'), { target: { value: 'https://x.com/cb' } });
    fireEvent.click(screen.getByTestId('dev-apps-create-submit'));

    await waitFor(() => expect(screen.queryByTestId('dev-apps-create-error')).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(1); // only initial GET, no POST
  });

  it('Validation: empty redirect_uris → inline error, no POST', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ apps: [] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.useRealTimers();

    render(<MemoryRouter><DeveloperAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('dev-apps-new')).toBeTruthy());
    fireEvent.click(screen.getByTestId('dev-apps-new'));

    fireEvent.change(screen.getByTestId('dev-apps-name'), { target: { value: 'My App' } });
    // leave redirect_uris empty
    fireEvent.click(screen.getByTestId('dev-apps-create-submit'));

    await waitFor(() => expect(screen.queryByTestId('dev-apps-create-error')).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('GET fail → error banner', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    vi.useRealTimers();

    render(<MemoryRouter><DeveloperAppsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('dev-apps-error')).toBeTruthy());
  });
});
