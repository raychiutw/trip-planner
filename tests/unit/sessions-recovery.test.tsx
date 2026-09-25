import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import SessionsPage from '../../src/pages/SessionsPage';
import { readAuthHint } from '../../src/lib/authHint';
const rows = [
  { sid: 'current', ua_summary: 'Chrome Desktop', ip_hash_prefix: null, created_at: '2026-09-25 00:00:00', last_seen_at: '2026-09-25 01:00:00', is_current: true },
  { sid: 'phone', ua_summary: 'Safari Phone', ip_hash_prefix: 'abc', created_at: 'invalid', last_seen_at: '2026-09-25T02:00:00Z', is_current: false },
  { sid: 'tablet', ua_summary: null, ip_hash_prefix: null, created_at: '2026-09-20T00:00:00Z', last_seen_at: '2026-09-24T00:00:00Z', is_current: false },
];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let list: unknown; let readStatus: number; let mutationStatus: number; let mutationBody: unknown;
let userStatus: number;
let pending: Promise<Response> | undefined; let writes: string[];
beforeEach(() => {
  list = { current_sid: 'current', sessions: rows }; readStatus = 200; mutationStatus = 200;
  userStatus = 200; mutationBody = undefined; pending = undefined; writes = []; localStorage.clear(); window.scrollTo = vi.fn();
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-25T03:00:00Z'));
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'https://test').pathname;
    if (path === '/api/oauth/userinfo') return json({ id: 'reader', email: 'reader@example.com', displayName: 'Reader' }, userStatus);
    if (init?.method === 'DELETE' || init?.method === 'POST') {
      writes.push(path);
      if (pending) return pending;
      if (path === '/api/oauth/logout') return new Response(null, { status: mutationStatus === 200 ? 204 : mutationStatus });
      return json(mutationBody ?? (path.endsWith('/sessions') ? { ok: true, revoked: 2 } : { ok: true, revoked_sid: decodeURIComponent(path.split('/').at(-1)!) }), mutationStatus);
    }
    if (path === '/api/account/sessions') return json(list, readStatus);
    return json([]);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
function open() { return render(<MemoryRouter initialEntries={['/settings/sessions']}><Location /><Routes>
  <Route path="/settings/sessions" element={<SessionsPage />} /><Route path="/login" element={<h1>登入</h1>} />
</Routes></MemoryRouter>); }

describe('session scopes and recovery through the real page', () => {
  it('an unauthenticated visit retains the device page as the login return target', async () => {
    userStatus = 401; open(); await screen.findByRole('heading', { name: '登入' });
    expect(screen.getByTestId('location')).toHaveTextContent('/login?redirect_after=%2Fsettings%2Fsessions');
    expect(writes).toHaveLength(0);
  });
  it('failed reads can retry to confirmed emptiness without pretending failure is empty', async () => {
    readStatus = 503; open(); await screen.findByTestId('sessions-error');
    expect(screen.queryByTestId('sessions-empty')).not.toBeInTheDocument();
    readStatus = 200; list = { current_sid: 'current', sessions: [] };
    fireEvent.click(screen.getByRole('button', { name: '重試載入裝置' }));
    await screen.findByTestId('sessions-empty'); expect(screen.queryByTestId('sessions-error')).not.toBeInTheDocument();
  });
  it('untrusted current-device flags cannot expose the current session as another device', async () => {
    list = { current_sid: 'current', sessions: rows.map(row => ({ ...row, is_current: false })) };
    open(); await screen.findByTestId('sessions-error');
    expect(screen.queryByTestId('sessions-revoke-current')).not.toBeInTheDocument();
  });
  it('single revoke retains the row on failure, retries the same identity, and restores useful focus', async () => {
    open(); const button = await screen.findByTestId('sessions-revoke-phone');
    mutationStatus = 403; button.focus(); fireEvent.click(button);
    await screen.findByText('登出此裝置失敗，請稍後再試。');
    expect(screen.getByTestId('sessions-row-phone')).toBeInTheDocument();
    mutationStatus = 200; fireEvent.click(button);
    await waitFor(() => expect(screen.queryByTestId('sessions-row-phone')).not.toBeInTheDocument());
    expect(screen.queryByTestId('sessions-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('sessions-row-current')).toBeInTheDocument();
    expect(document.activeElement).not.toBe(document.body);
    expect(writes).toEqual(['/api/account/sessions/phone', '/api/account/sessions/phone']);
  });
  it('bulk confirmation remains open while pending and failed, prevents overlapping scopes, then keeps current only', async () => {
    let resolve!: (response: Response) => void;
    pending = new Promise(r => { resolve = r; });
    open(); const all = await screen.findByTestId('sessions-revoke-all'); all.focus(); fireEvent.click(all);
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByTestId('sessions-revoke-phone')).toBeDisabled();
    expect(screen.getByTestId('sessions-logout')).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await act(async () => resolve(json({ error: { code: 'PERM_DENIED' } }, 403)));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('登出其他裝置失敗，請稍後再試。');
    expect(screen.getByTestId('sessions-row-phone')).toBeInTheDocument();
    pending = undefined; fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('sessions-row-current')).toBeInTheDocument();
    expect(screen.queryByTestId('sessions-row-phone')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sessions-row-tablet')).not.toBeInTheDocument();
    expect(writes).toEqual(['/api/account/sessions', '/api/account/sessions']);
    expect(document.activeElement).not.toBe(document.body);
  });
  it('current-device logout does not claim success after HTTP rejection', async () => {
    open(); await screen.findByTestId('sessions-row-current'); mutationStatus = 500;
    fireEvent.click(screen.getByTestId('sessions-logout'));
    await screen.findByText('登出目前裝置失敗，請稍後再試。');
    expect(screen.getByTestId('location')).toHaveTextContent('/settings/sessions');
    expect(readAuthHint()).toBe(true);
    mutationStatus = 200; fireEvent.click(screen.getByTestId('sessions-logout'));
    await screen.findByRole('heading', { name: '登入' });
    expect(readAuthHint()).toBe(false);
    expect(writes).toEqual(['/api/oauth/logout', '/api/oauth/logout']);
  });
  it.each([{ ok: false }, { ok: true, revoked_sid: 'current' }])('unconfirmed single revoke leaves the intended row intact: %j', async response => {
    mutationBody = response; open(); fireEvent.click(await screen.findByTestId('sessions-revoke-phone'));
    await screen.findByText('登出此裝置失敗，請稍後再試。'); expect(screen.getByTestId('sessions-row-phone')).toBeInTheDocument();
  });
  it('shows valid UTC times, identifies current device, and avoids invalid date output', async () => {
    open(); await screen.findByTestId('sessions-row-current');
    expect(screen.getByTestId('sessions-row-current')).toHaveTextContent('目前');
    expect(screen.getByTestId('sessions-row-current')).toHaveTextContent('2 小時前');
    expect(screen.getByTestId('sessions-row-phone')).toHaveTextContent('時間不明');
    expect(screen.getByTestId('sessions-row-phone')).not.toHaveTextContent('invalid');
    expect(screen.queryByTestId('sessions-revoke-current')).not.toBeInTheDocument();
  });
});
