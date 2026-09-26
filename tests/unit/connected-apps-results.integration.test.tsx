import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ConnectedAppsPage from '../../src/pages/ConnectedAppsPage';

vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

const user = { id: 'u1', email: 'ray@example.test', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' };
const app = {
  client_id: 'calendar', app_name: 'Calendar Exporter', app_logo_url: null,
  app_description: null, homepage_url: null, status: 'active',
  scopes: ['openid', 'profile', 'email', 'trips.read', 'trips.write'],
  granted_at: new Date('2026-04-18T00:00:00Z').getTime(),
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let appsResponse: Response;
let revokeResponse: Response;
let revokeReply: Promise<Response> | null;
let requests: { path: string; method: string }[];

beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn();
  appsResponse = json({ apps: [app] });
  revokeResponse = json({ ok: true, revoked_client_id: app.client_id });
  revokeReply = null;
  requests = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'https://test').pathname;
    requests.push({ path, method: init?.method ?? 'GET' });
    if (path === '/api/oauth/userinfo') return Promise.resolve(json(user));
    if (path === '/api/account/ai-authorization') return Promise.resolve(json({ authorized: false }));
    if (path === '/api/account/connected-apps' && !init?.method) return Promise.resolve(appsResponse);
    if (path === '/api/account/connected-apps/calendar' && init?.method === 'DELETE') return revokeReply ?? Promise.resolve(revokeResponse);
    return Promise.resolve(json({}));
  }));
});

it('distinguishes an empty grant list from a failed read', async () => {
  appsResponse = json({ apps: [] });
  showPage();
  expect(await screen.findByTestId('connected-apps-empty')).toBeVisible();
  expect(screen.queryByTestId('connected-apps-error')).toBeNull();
});

it('shows a failed read without saying the grant list is empty', async () => {
  appsResponse = json({ error: { code: 'SYS_INTERNAL' } }, 503);
  showPage();
  expect(await screen.findByTestId('connected-apps-error')).toHaveTextContent('無法載入已連結應用');
  expect(screen.queryByTestId('connected-apps-empty')).toBeNull();
});

it('keeps a failed revoke visible and retryable until the server confirms the same client', async () => {
  let resolveDelete!: (response: Response) => void;
  revokeReply = new Promise<Response>((resolve) => { resolveDelete = resolve; });
  showPage();
  fireEvent.click(await screen.findByTestId('connected-apps-revoke-calendar'));
  fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
  expect(screen.getByTestId('connected-apps-row-calendar')).toBeVisible();
  await waitFor(() => expect(requests.filter((r) => r.method === 'DELETE')).toHaveLength(1));
  resolveDelete(json({ error: { code: 'SYS_INTERNAL' } }, 503));
  expect(await screen.findByText('撤銷失敗，請重試。')).toBeVisible();
  expect(screen.getByTestId('confirm-modal')).toBeVisible();
  expect(screen.getByTestId('connected-apps-row-calendar')).toBeVisible();
  revokeReply = null;
  fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
  await waitFor(() => expect(screen.queryByTestId('connected-apps-row-calendar')).toBeNull());
  expect(requests.filter((r) => r.method === 'DELETE')).toHaveLength(2);
});

it('does not remove a grant when a successful HTTP response does not confirm its client', async () => {
  revokeResponse = json({ ok: true, revoked_client_id: 'some-other-client' });
  showPage();
  fireEvent.click(await screen.findByTestId('connected-apps-revoke-calendar'));
  fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
  expect(await screen.findByText('撤銷失敗，請重試。')).toBeVisible();
  expect(screen.getByTestId('connected-apps-row-calendar')).toBeVisible();
});

it('names the actual granted access in the revoke confirmation', async () => {
  appsResponse = json({ apps: [{ ...app, scopes: ['openid', 'profile'] }] });
  showPage();
  fireEvent.click(await screen.findByTestId('connected-apps-revoke-calendar'));
  const dialog = screen.getByTestId('confirm-modal');
  expect(dialog).toHaveTextContent('身分識別、基本資料');
  expect(dialog).not.toHaveTextContent('修改你的行程');
});
afterEach(() => { vi.unstubAllGlobals(); });

function showPage() {
  render(<MemoryRouter initialEntries={['/settings/connected-apps']}><ConnectedAppsPage /></MemoryRouter>);
}

it('shows every granted permission in readable words and the local authorization date', async () => {
  showPage();
  const row = await screen.findByTestId('connected-apps-row-calendar');
  expect(row).toHaveTextContent('Calendar Exporter');
  expect(row).toHaveTextContent('身分識別');
  expect(row).toHaveTextContent('基本資料');
  expect(row).toHaveTextContent('電子郵件');
  expect(row).toHaveTextContent('查看行程');
  expect(row).toHaveTextContent('修改行程');
  expect(row).toHaveTextContent('2026');
  expect(row).toHaveTextContent('4');
  expect(row).toHaveTextContent('18');
});
