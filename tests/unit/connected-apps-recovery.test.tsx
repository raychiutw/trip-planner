import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import ConnectedAppsPage from '../../src/pages/ConnectedAppsPage';
const sample = { client_id: 'tool/a', app_name: 'Planning Tool', app_logo_url: null, app_description: null, homepage_url: null, status: 'active', scopes: ['openid', 'profile', 'email', 'trips:write', 'future:scope'], granted_at: Date.parse('2026-09-24T00:00:00Z') };
let apps: typeof sample[]; let listStatus: number; let deleteStatus: number; let deleteBody: unknown;
let ai: boolean; let aiStatus: number; let writes: string[];
let pending: Promise<Response> | undefined;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => {
  apps = [sample]; listStatus = 200; deleteStatus = 200; deleteBody = undefined; ai = false; aiStatus = 200; writes = []; pending = undefined;
  window.scrollTo = vi.fn(); localStorage.clear();
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-25T00:00:00Z'));
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'https://test').pathname;
    if (path === '/api/oauth/userinfo') return json({ id: 'reader', email: 'reader@example.com', displayName: 'Reader' });
    if (path === '/api/account/ai-authorization') {
      if (init?.method === 'POST') { ai = true; apps = [{ ...sample, client_id: 'tripline-tp-request', app_name: 'Tripline AI' }]; }
      return json({ authorized: ai }, aiStatus);
    }
    if (init?.method === 'DELETE') {
      writes.push(path); if (pending) return pending;
      if (deleteStatus !== 200) return json({ error: { code: 'PERM_DENIED' } }, deleteStatus);
      const id = decodeURIComponent(path.split('/').at(-1)!); apps = apps.filter(app => app.client_id !== id); if (id === 'tripline-tp-request') ai = false;
      return json(deleteBody ?? { ok: true, revoked_client_id: id });
    }
    if (path === '/api/account/connected-apps') return json({ apps }, listStatus);
    return json([]);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function open() { render(<StrictMode><MemoryRouter><ConnectedAppsPage /></MemoryRouter></StrictMode>); }
async function confirm(id = 'tool/a') { const trigger = await screen.findByTestId(`connected-apps-revoke-${id}`); trigger.focus(); fireEvent.click(trigger); fireEvent.click(screen.getByTestId('confirm-modal-confirm')); }

describe('connected grant recovery', () => {
  it('reveals every scope with descriptions and the client identity', async () => {
    open(); const row = await screen.findByTestId('connected-apps-row-tool/a');
    expect(row).toHaveTextContent('授權 1 天前');
    expect(row).toHaveTextContent('tool/a'); expect(row).toHaveTextContent('trips:write');
    expect(row).toHaveTextContent('建立 / 修改您的行程'); expect(row).toHaveTextContent('future:scope');
  });
  it('failed list reads offer retry to a confirmed empty list', async () => {
    listStatus = 503; open(); await screen.findByTestId('connected-apps-error');
    expect(screen.queryByTestId('connected-apps-empty')).not.toBeInTheDocument();
    listStatus = 200; apps = []; fireEvent.click(screen.getByRole('button', { name: '重試載入應用' }));
    await screen.findByTestId('connected-apps-empty');
  });
  it('failed revoke is visible inside confirmation, retains its target, and can retry', async () => {
    deleteStatus = 403; open(); await confirm();
    await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent('撤銷失敗，請稍後再試。'));
    expect(screen.getByTestId('connected-apps-row-tool/a')).toBeInTheDocument();
    deleteStatus = 200; fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    await screen.findByTestId('connected-apps-empty');
    expect(screen.queryByTestId('connected-apps-error')).not.toBeInTheDocument();
    expect(document.activeElement).not.toBe(document.body);
    expect(writes).toEqual(['/api/account/connected-apps/tool%2Fa', '/api/account/connected-apps/tool%2Fa']);
  });
  it('unconfirmed server results do not remove a grant', async () => {
    deleteBody = { ok: true, revoked_client_id: 'different' }; open(); await confirm();
    await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent('撤銷失敗'));
    expect(screen.getByTestId('connected-apps-row-tool/a')).toBeInTheDocument();
  });
  it('pending revocation cannot be dismissed or sent twice', async () => {
    let resolve!: (response: Response) => void; pending = new Promise(r => { resolve = r; });
    open(); await confirm(); fireEvent.click(screen.getByTestId('confirm-modal-confirm')); fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument(); expect(writes).toHaveLength(1);
    await act(async () => resolve(json({ ok: true, revoked_client_id: 'tool/a' })));
    await screen.findByTestId('connected-apps-empty');
  });
  it('AI authorization and revocation refresh the same grant facts without reloading the page', async () => {
    apps = []; open(); await screen.findByTestId('connected-apps-empty');
    fireEvent.click(await screen.findByRole('button', { name: '授權 AI' }));
    await screen.findByTestId('connected-apps-row-tripline-tp-request');
    await screen.findByTestId('ai-authorize-on');
    await confirm('tripline-tp-request'); await screen.findByTestId('connected-apps-empty');
    await screen.findByRole('button', { name: '授權 AI' });
    expect(screen.queryByTestId('ai-authorize-on')).not.toBeInTheDocument();
  });
  it('failed refresh after an accepted grant does not claim the old empty list is current', async () => {
    apps = []; open(); await screen.findByTestId('connected-apps-empty');
    listStatus = 503; fireEvent.click(await screen.findByRole('button', { name: '授權 AI' }));
    await screen.findByTestId('ai-authorize-on'); await screen.findByTestId('connected-apps-error');
    expect(screen.queryByTestId('connected-apps-empty')).not.toBeInTheDocument();
    listStatus = 200; fireEvent.click(screen.getByRole('button', { name: '重試載入應用' }));
    await screen.findByTestId('connected-apps-row-tripline-tp-request');
  });
  it('AI read failure is unknown and retryable, not an invitation to grant again', async () => {
    aiStatus = 503; open(); const card = await screen.findByTestId('ai-authorize-card');
    await within(card).findByRole('button', { name: '重試讀取授權' });
    expect(within(card).queryByRole('button', { name: '授權 AI' })).not.toBeInTheDocument();
    aiStatus = 200; ai = true; fireEvent.click(within(card).getByRole('button', { name: '重試讀取授權' }));
    await screen.findByTestId('ai-authorize-on');
  });
});
