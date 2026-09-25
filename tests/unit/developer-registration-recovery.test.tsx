import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DeveloperAppNewPage from '../../src/pages/DeveloperAppNewPage';
import DeveloperAppsPage from '../../src/pages/DeveloperAppsPage';
const result = { client_id: 'tp_registered', client_secret: 'tps_once-only', app_name: 'Planner', client_type: 'confidential', status: 'pending_review', redirect_uris: ['https://example.com/cb'], allowed_scopes: ['openid', 'profile', 'email'] };
let status: number; let detail: string; let responseBody: unknown; let writes: Record<string, unknown>[]; let pending: Promise<Response> | undefined;
const json = (body: unknown, code = 200) => new Response(JSON.stringify(body), { status: code });
beforeEach(() => {
  status = 201; detail = ''; responseBody = undefined; writes = []; pending = undefined;
  window.scrollTo = vi.fn(); localStorage.clear(); sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'https://test').pathname;
    if (path === '/api/oauth/userinfo') return json({ id: 'reader', email: 'reader@example.com', displayName: 'Reader' });
    if (path === '/api/dev/apps' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)); writes.push(body);
      return pending ?? json(responseBody ?? (status >= 400 ? { error: { code: 'DATA_VALIDATION', detail } } : { ...result, ...body, client_secret: body.client_type === 'confidential' ? result.client_secret : null }), status);
    }
    if (path === '/api/dev/apps') return json({ apps: [] });
    return json([]);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function open() { return render(<StrictMode><MemoryRouter initialEntries={['/developer/apps/new']}><Routes><Route path="/developer/apps/new" element={<DeveloperAppNewPage />} /><Route path="/developer/apps" element={<DeveloperAppsPage />} /></Routes></MemoryRouter></StrictMode>); }
async function fill(confidential = false) {
  fireEvent.change(await screen.findByTestId('dev-app-new-name'), { target: { value: 'Planner' } });
  fireEvent.change(screen.getByTestId('dev-app-new-uris'), { target: { value: 'https://example.com/cb' } });
  if (confidential) fireEvent.click(screen.getByTestId('dev-app-new-type-confidential'));
}
function submit() { fireEvent.click(screen.getByTestId('dev-app-new-submit')); }
it('names type and scope groups and offers only scopes accepted by self-service registration', async () => {
  open(); await fill();
  expect(screen.getByRole('group', { name: '類型' })).toBeInTheDocument();
  const scopes = screen.getByRole('group', { name: '申請的 scopes' });
  expect(within(scopes).getAllByRole('checkbox')).toHaveLength(4);
  fireEvent.click(within(scopes).getByRole('checkbox', { name: /offline_access/ })); submit();
  await screen.findByRole('dialog', { name: '應用程式憑證' });
  expect(writes[0].allowed_scopes).toEqual(['openid', 'profile', 'email', 'offline_access']);
  expect(screen.queryByTestId('dev-app-new-secret-client-secret')).not.toBeInTheDocument();
});
it('maps server URI errors back to the original line and preserves the draft for correction', async () => {
  status = 400; detail = 'redirect_uris[1] 必須是 HTTPS（localhost 例外）'; open(); await fill();
  const uris = 'https://example.com/good\n\nhttp://bad.example/cb';
  fireEvent.change(screen.getByTestId('dev-app-new-uris'), { target: { value: uris } }); submit();
  expect(await screen.findByTestId('dev-app-new-error')).toHaveTextContent('第 3 行');
  expect(screen.getByTestId('dev-app-new-uris')).toHaveValue(uris);
  await waitFor(() => expect(screen.getByTestId('dev-app-new-uris')).toHaveFocus());
  expect(screen.getByTestId('dev-app-new-uris')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByTestId('dev-app-new-name')).toHaveValue('Planner');
  status = 201; fireEvent.change(screen.getByTestId('dev-app-new-uris'), { target: { value: 'https://example.com/good\n\nhttps://fixed.example/cb' } }); submit();
  await screen.findByRole('dialog'); expect(writes[1].redirect_uris).toEqual(['https://example.com/good', 'https://fixed.example/cb']);
});
it('does not silently restore default permissions when the user clears every scope', async () => {
  open(); await fill();
  for (const checkbox of within(screen.getByRole('group', { name: '申請的 scopes' })).getAllByRole('checkbox')) {
    if ((checkbox as HTMLInputElement).checked) fireEvent.click(checkbox);
  }
  submit(); expect(await screen.findByTestId('dev-app-new-error')).toHaveTextContent('至少選擇一項');
  expect(writes).toHaveLength(0);
});
it('clipboard failure is explicit, keeps the one-time credential, and supports retry', async () => {
  const writeText = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce(undefined);
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { clipboard: { writeText } }));
  open(); await fill(true); submit(); const dialog = await screen.findByRole('dialog', { name: '應用程式憑證' });
  fireEvent.click(within(dialog).getByRole('button', { name: '複製 Client Secret' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('複製失敗');
  expect(dialog).toHaveTextContent(result.client_secret);
  fireEvent.click(within(dialog).getByRole('button', { name: '複製 Client Secret' }));
  expect(await within(dialog).findByRole('status')).toHaveTextContent('Client Secret 已複製');
  expect(writeText.mock.calls).toEqual([[result.client_secret], [result.client_secret]]);
  expect(JSON.stringify(localStorage)).not.toContain(result.client_secret); expect(JSON.stringify(sessionStorage)).not.toContain(result.client_secret);
  fireEvent.keyDown(document, { key: 'Escape' }); expect(dialog).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('dev-app-new-secret-acknowledge')); await screen.findByTestId('dev-apps-empty');
  expect(screen.queryByText(result.client_secret)).not.toBeInTheDocument();
});
it('ignores repeat submissions while one registration is pending and locks the submitted draft', async () => {
  let resolve!: (response: Response) => void; pending = new Promise(r => { resolve = r; }); open(); await fill(true);
  const form = screen.getByTestId('dev-app-new-name').closest('form')!;
  act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(writes).toHaveLength(1);
  expect(screen.getByTestId('dev-app-new-name')).toBeDisabled();
  await act(async () => resolve(json(result, 201))); await screen.findByRole('dialog');
  fireEvent.submit(form); expect(writes).toHaveLength(1);
});
it('does not accept an incomplete credential response as success or invite another creation', async () => {
  responseBody = { ...result, client_secret: null }; open(); await fill(true); submit();
  expect(await screen.findByTestId('dev-app-new-error')).toHaveTextContent('可能已建立');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByTestId('dev-app-new-submit')).toBeDisabled();
  expect(screen.getByTestId('dev-app-new-cancel')).toBeEnabled();
});
it('leaving while creating prevents a late response from rendering credentials on the next page', async () => {
  let resolve!: (response: Response) => void; pending = new Promise(r => { resolve = r; }); const view = open(); await fill(true); submit();
  view.unmount(); await act(async () => resolve(json(result, 201)));
  expect(screen.queryByText(result.client_secret)).not.toBeInTheDocument();
});
