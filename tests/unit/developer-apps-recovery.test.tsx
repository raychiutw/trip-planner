import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import DeveloperAppsPage from '../../src/pages/DeveloperAppsPage';
import { EVENT } from '../../src/lib/events';
const app = { client_id: 't30-client', client_type: 'confidential', app_name: 'Planner', app_description: null, homepage_url: null, redirect_uris: ['https://example.com/' + 'callback'.repeat(60)], allowed_scopes: ['openid'], status: 'active', created_at: '2026-09-24T00:00:00Z', updated_at: '2026-09-24T00:00:00Z', client_secret: 'never-render-secret', client_secret_hash: 'never-render-hash' };
let body: unknown; let status: number; let pending: Promise<Response> | undefined;
const json = (value: unknown, code = 200) => new Response(JSON.stringify(value), { status: code });
beforeEach(() => {
  body = { apps: [app] }; status = 200; pending = undefined;
  window.scrollTo = vi.fn(); localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input), 'https://test').pathname;
    if (path === '/api/oauth/userinfo') return json({ id: 'reader', email: 'reader@example.com', displayName: 'Reader' });
    if (path === '/api/dev/apps') return pending ?? json(body, status);
    return json([]);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function open() { render(<StrictMode><MemoryRouter><DeveloperAppsPage /></MemoryRouter></StrictMode>); }
function refresh() { act(() => window.dispatchEvent(new Event(EVENT.developerAppCreated))); }
it('distinguishes denied access from empty and can recheck permission', async () => {
  status = 403; open();
  expect(await screen.findByTestId('dev-apps-error')).toHaveTextContent('沒有權限');
  expect(screen.queryByTestId('dev-apps-empty')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '建立新應用' })).not.toBeInTheDocument();
  status = 200; body = { apps: [] }; fireEvent.click(screen.getByRole('button', { name: '重試載入應用' }));
  await screen.findByTestId('dev-apps-empty');
  expect(screen.getByRole('button', { name: '建立第一個應用' })).toBeInTheDocument();
});
it.each([null, { apps: [app, app] }, { apps: [{ ...app, redirect_uris: [null] }] }, { apps: [{ ...app, app_name: { unexpected: true } }] }])('rejects malformed registry data instead of rendering broken or duplicated identities: %j', async value => {
  body = value; open();
  await screen.findByTestId('dev-apps-error');
  expect(screen.queryByTestId('dev-apps-row-t30-client')).not.toBeInTheDocument();
  body = { apps: [app] }; fireEvent.click(screen.getByRole('button', { name: '重試載入應用' }));
  await screen.findByTestId('dev-apps-row-t30-client');
});
it('failed refresh preserves known rows, but never presents a stale empty list as current', async () => {
  open(); await screen.findByTestId('dev-apps-row-t30-client');
  status = 500; refresh(); await screen.findByTestId('dev-apps-error');
  expect(screen.getByTestId('dev-apps-row-t30-client')).toBeInTheDocument();
  status = 200; body = { apps: [] }; fireEvent.click(screen.getByRole('button', { name: '重試載入應用' }));
  await screen.findByTestId('dev-apps-empty');
  status = 500; refresh(); await screen.findByTestId('dev-apps-error');
  expect(screen.queryByTestId('dev-apps-empty')).not.toBeInTheDocument();
});
it('denied refresh clears private metadata and creation controls', async () => {
  open(); await screen.findByTestId('dev-apps-row-t30-client');
  status = 403; refresh(); await screen.findByTestId('dev-apps-error');
  expect(screen.queryByTestId('dev-apps-row-t30-client')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '建立新應用' })).not.toBeInTheDocument();
});
it('an older response cannot erase the registry read after creation', async () => {
  let resolve!: (response: Response) => void;
  pending = new Promise(r => { resolve = r; }); open();
  await screen.findByRole('button', { name: '建立新應用' });
  pending = undefined; refresh(); await screen.findByTestId('dev-apps-row-t30-client');
  await act(async () => resolve(json({ apps: [] })));
  expect(screen.getByTestId('dev-apps-row-t30-client')).toBeInTheDocument();
  expect(screen.queryByTestId('dev-apps-empty')).not.toBeInTheDocument();
});
it('displays complete callback metadata as text and never renders secrets', async () => {
  open(); const row = await screen.findByTestId('dev-apps-row-t30-client');
  expect(row).toHaveTextContent(app.redirect_uris[0]);
  expect(document.body.innerHTML).not.toContain(app.client_secret);
  expect(document.body.innerHTML).not.toContain(app.client_secret_hash);
});
it('keeps a denied registry unavailable while retry is pending and restores useful focus after success', async () => {
  status = 403; open(); await screen.findByTestId('dev-apps-error');
  let resolve!: (response: Response) => void; pending = new Promise(r => { resolve = r; });
  const retry = screen.getByRole('button', { name: '重試載入應用' }); retry.focus(); fireEvent.click(retry);
  expect(retry).toBeDisabled();
  expect(screen.queryByRole('button', { name: '建立新應用' })).not.toBeInTheDocument();
  await act(async () => resolve(json({ apps: [] })));
  await screen.findByTestId('dev-apps-empty');
  expect(document.activeElement).not.toBe(document.body);
});
