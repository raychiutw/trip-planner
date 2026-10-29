import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import CollabPage from '../../src/pages/CollabPage';
import { resetToasts } from '../../src/lib/toastBus';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';

const user = { id: 'u1', email: 'owner@example.com', emailVerified: true, displayName: 'Owner', avatarUrl: null, createdAt: '' };
const trip = { tripId: 'trip-1', title: '京都旅行', role: 'owner' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
});

function TripsMarker() {
  const { search } = useLocation();
  return <div data-testid="trips-page">{search}</div>;
}

function mount() {
  return render(
    <MemoryRouter initialEntries={['/trip/trip-1/collab']}>
      <ActiveTripProvider>
        <Routes>
          <Route path="/trip/:tripId/collab" element={<CollabPage />} />
          <Route path="/trips" element={<TripsMarker />} />
        </Routes>
      </ActiveTripProvider>
    </MemoryRouter>,
  );
}

describe('CollabPage permission and trip identity', () => {
  let fetcher: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetcher = vi.fn(async (input: string) => {
      if (input === '/api/oauth/userinfo') return reply(user);
      if (input === '/api/my-trips') return reply([trip]);
      if (input.startsWith('/api/permissions?')) return reply([]);
      if (input.startsWith('/api/invitations?')) return reply({ items: [] });
      throw new Error(`Unexpected request: ${input}`);
    });
    vi.stubGlobal('fetch', fetcher);
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => { cleanup(); resetToasts(); vi.unstubAllGlobals(); });

  it('identifies the trip and lets its owner manage people and return to it', async () => {
    mount();
    expect(await screen.findByRole('heading', { name: '京都旅行' })).toBeTruthy();
    expect(screen.getByText(/擁有者.*邀請.*移除/)).toBeTruthy();
    expect(await screen.findByTestId('collab-add-email')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /返回/ }));
    expect((await screen.findByTestId('trips-page')).textContent).toBe('?selected=trip-1');
  });

  it.each([
    ['member', /共編成員.*編輯.*擁有者.*管理/],
    ['viewer', /檢視成員.*檢視.*擁有者.*管理/],
  ])('explains %s ability without owner controls', async (role, message) => {
    fetcher.mockImplementation(async (input: string) => {
      if (input === '/api/oauth/userinfo') return reply(user);
      if (input === '/api/my-trips') return reply([{ ...trip, role }]);
      throw new Error(`Unexpected request: ${input}`);
    });
    mount();
    expect(await screen.findByRole('heading', { name: '京都旅行' })).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByTestId('collab-add-email')).toBeNull();
    expect(fetcher.mock.calls.some(([path]) => String(path).startsWith('/api/permissions'))).toBe(false);
  });

  it('never labels an unknown trip as the management target and offers retry', async () => {
    let attempts = 0;
    fetcher.mockImplementation(async (input: string) => {
      if (input === '/api/oauth/userinfo') return reply(user);
      if (input === '/api/my-trips') {
        attempts += 1;
        return attempts === 1 ? reply({ error: 'unavailable' }, 500) : reply([trip]);
      }
      if (input.startsWith('/api/permissions?')) return reply([]);
      if (input.startsWith('/api/invitations?')) return reply({ items: [] });
      throw new Error(`Unexpected request: ${input}`);
    });
    mount();
    expect(await screen.findByTestId('collab-page-error')).toBeTruthy();
    expect(screen.queryByTestId('collab-add-email')).toBeNull();
    expect(screen.queryByRole('heading', { name: '行程' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '重試' }));
    await waitFor(() => expect(attempts).toBe(2));
    expect(await screen.findByRole('heading', { name: '京都旅行' })).toBeTruthy();
  });

  it('keeps invitation input and failed revoke/remove targets for retry', async () => {
    fetcher.mockImplementation(async (input: string, options?: RequestInit) => {
      if (input === '/api/oauth/userinfo') return reply(user);
      if (input === '/api/my-trips') return reply([trip]);
      if (input.startsWith('/api/permissions?')) return reply([
        { id: 7, email: 'member@example.com', tripId: 'trip-1', role: 'member' },
      ]);
      if (input.startsWith('/api/invitations?')) return reply({ items: [
        { id: 'hash-1', invitedEmail: 'pending@example.com', createdAt: '', expiresAt: '', daysRemaining: 2, isExpired: false },
      ] });
      if (options?.method === 'POST' || options?.method === 'DELETE') {
        return reply({ error: { message: '伺服器暫時無法處理' } }, 500);
      }
      throw new Error(`Unexpected request: ${input}`);
    });
    mount();
    const email = await screen.findByTestId('collab-add-email') as HTMLInputElement;
    await screen.findByTestId('collab-remove-7');
    fireEvent.change(email, { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByTestId('collab-add-submit'));
    await waitFor(() => expect(screen.getByTestId('collab-add-error').textContent).toContain('伺服器暫時無法處理'));
    expect(email.value).toBe('new@example.com');
    fireEvent.click(screen.getByTestId('collab-add-submit'));
    await waitFor(() => expect(fetcher.mock.calls.filter(([path, options]) =>
      path === '/api/permissions' && options?.method === 'POST')).toHaveLength(2));

    screen.getByTestId('collab-remove-7').focus();
    fireEvent.click(screen.getByTestId('collab-remove-7'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('confirm-modal-cancel')));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    await waitFor(() => expect(fetcher.mock.calls.some(([path, options]) =>
      path === '/api/permissions/7' && options?.method === 'DELETE')).toBe(true));
    expect(await screen.findByTestId('collab-remove-error')).toBeTruthy();
    expect(screen.getByTestId('collab-remove-error').textContent).toContain('伺服器暫時無法處理');
    expect(screen.getByTestId('confirm-modal')).toBeTruthy();
    expect(screen.getByTestId('collab-row-7')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByTestId('confirm-modal-cancel'));
    await waitFor(() => expect((screen.getByTestId('confirm-modal-confirm') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    await waitFor(() => expect(fetcher.mock.calls.filter(([path, options]) =>
      path === '/api/permissions/7' && options?.method === 'DELETE')).toHaveLength(2));
    fireEvent.click(screen.getByTestId('confirm-modal-cancel'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('collab-remove-7')));

    screen.getByTestId('pending-revoke-pending@example.com').focus();
    fireEvent.click(screen.getByTestId('pending-revoke-pending@example.com'));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    await waitFor(() => expect(fetcher.mock.calls.some(([path, options]) =>
      path === '/api/invitations/revoke' && options?.method === 'POST')).toBe(true));
    expect(await screen.findByTestId('collab-revoke-error')).toBeTruthy();
    expect(screen.getByTestId('collab-revoke-error').textContent).toContain('伺服器暫時無法處理');
    expect(screen.getByTestId('confirm-modal').textContent).toContain('撤銷邀請');
    expect(screen.getByTestId('pending-row-pending@example.com')).toBeTruthy();
    await waitFor(() => expect((screen.getByTestId('confirm-modal-confirm') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    await waitFor(() => expect(fetcher.mock.calls.filter(([path, options]) =>
      path === '/api/invitations/revoke' && options?.method === 'POST')).toHaveLength(2));
  });
});
