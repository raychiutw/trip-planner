import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AccountPage from '../../src/pages/AccountPage';
import ToastContainer, { resetToasts } from '../../src/components/shared/Toast';
import AccountSheet from '../../src/components/shell/AccountSheet';
import { AccountSheetProvider } from '../../src/contexts/AccountSheetContext';

vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

const user = { id: 'u1', email: 'ray@example.test', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let preview: unknown;
let deleteResponse: Response;
let statsResponse: Response;
let profileResponse: Response;
let previewResponse: Response | null;
let previewReplies: Promise<Response>[];
let requests: { path: string; method: string; body: string | null }[];

beforeEach(() => {
  localStorage.clear();
  requests = [];
  preview = { hasPassword: true, tripsOwned: 2, collaboratorsAffected: 1 };
  deleteResponse = json({ error: { code: 'ACCOUNT_DELETE_PASSWORD_INVALID' } }, 401);
  statsResponse = json({ tripCount: 3, totalDays: 7, collaboratorCount: 1 });
  profileResponse = json({ ...user, displayName: 'New Ray' });
  previewResponse = null;
  previewReplies = [];
  resetToasts();
  window.scrollTo = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'https://test').pathname;
    requests.push({ path, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : null });
    if (path === '/api/oauth/userinfo') return json(user);
    if (path === '/api/account/stats') return statsResponse;
    if (path === '/api/account/profile' && init?.method === 'PATCH') return profileResponse;
    if (path === '/api/account' && init?.method === 'DELETE') return deleteResponse;
    if (path === '/api/account') return previewReplies.shift() ?? previewResponse ?? json(preview);
    return json({});
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

function showAccount(surface: 'page' | 'sheet' = 'page') {
  render(<MemoryRouter initialEntries={['/account']}><ToastContainer />
    {surface === 'sheet'
      ? <AccountSheetProvider><AccountSheet><AccountPage /></AccountSheet></AccountSheetProvider>
      : <AccountPage />}
  </MemoryRouter>);
}

it('keeps profile available and labels stats unavailable when stats loading fails', async () => {
  statsResponse = json({ error: { code: 'SYS_INTERNAL' } }, 503);
  showAccount();
  expect(await screen.findByText('Ray')).toBeVisible();
  expect(await screen.findByRole('status')).toHaveTextContent('數據載入失敗');
  const values = [...screen.getByTestId('account-hero').querySelectorAll('.tp-account-hero-stat-value')];
  expect(values.map((value) => value.textContent)).toEqual(['—', '—', '—']);
  expect(screen.getByTestId('account-row-delete-account')).toBeEnabled();
});

it('shows the confirmed name before a slow userinfo refresh resolves', async () => {
  showAccount();
  fireEvent.click(await screen.findByTestId('account-edit-name-btn'));
  const input = await screen.findByTestId('account-edit-name-input');
  fireEvent.change(input, { target: { value: 'New Ray' } });
  await act(async () => { (input as HTMLInputElement).focus(); (input as HTMLInputElement).blur(); });
  await waitFor(() => expect(requests.some((request) => request.path === '/api/account/profile' && request.method === 'PATCH')).toBe(true));
  expect(await screen.findByText('New Ray')).toBeVisible();
});

it('keeps a failed name edit retryable and restores focus to the input', async () => {
  profileResponse = json({ error: { code: 'SYS_INTERNAL' } }, 503);
  showAccount();
  fireEvent.click(await screen.findByTestId('account-edit-name-btn'));
  const input = await screen.findByTestId('account-edit-name-input');
  fireEvent.change(input, { target: { value: 'New Ray' } });
  await act(async () => { (input as HTMLInputElement).focus(); (input as HTMLInputElement).blur(); });
  expect(await screen.findByRole('alert')).toBeVisible();
  await waitFor(() => expect(input).toHaveFocus());
  expect(input).toHaveValue('New Ray');
});

it('keeps the account and confirmation open when the server rejects deletion', async () => {
  showAccount();
  fireEvent.click(await screen.findByTestId('account-row-delete-account'));
  const password = await screen.findByTestId('delete-account-confirm-input');
  fireEvent.change(password, { target: { value: 'wrong-password' } });
  fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
  await waitFor(() => expect(requests.some((request) => request.path === '/api/account' && request.method === 'DELETE')).toBe(true));
  expect(await screen.findByText('密碼不正確，帳號未刪除')).toBeVisible();
  expect(screen.getByTestId('confirm-modal')).toBeVisible();
});

it('does not present an incomplete delete preview as valid impact data', async () => {
  preview = { hasPassword: false };
  showAccount();
  fireEvent.click(await screen.findByTestId('account-row-delete-account'));
  expect(await screen.findByText('無法取得刪除影響範圍，請稍後再試')).toBeVisible();
  expect(screen.queryByTestId('delete-account-confirm-input')).toBeNull();
  expect(screen.getByTestId('confirm-modal-confirm')).toBeDisabled();
  expect(screen.getByTestId('confirm-modal-confirm')).toHaveTextContent('永久刪除');
  fireEvent.click(screen.getByTestId('confirm-modal-cancel'));
  expect(screen.queryByTestId('confirm-modal')).toBeNull();
});

it('lets the user leave a failed delete preview and returns focus to the trigger in the Account sheet', async () => {
  previewResponse = json({ error: { code: 'SYS_INTERNAL' } }, 503);
  showAccount('sheet');
  const trigger = await screen.findByTestId('account-row-delete-account');
  trigger.focus();
  fireEvent.click(trigger);
  expect(await screen.findByText('無法取得刪除影響範圍，請稍後再試')).toBeVisible();
  fireEvent.click(screen.getByTestId('confirm-modal-cancel'));
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(screen.getByRole('dialog', { name: '帳號' })).toBeVisible();
});

it('ignores a cancelled preview that resolves after a newer delete preview', async () => {
  let resolveOld!: (response: Response) => void;
  previewReplies = [
    new Promise<Response>((resolve) => { resolveOld = resolve; }),
    Promise.resolve(json({ hasPassword: true, tripsOwned: 2, collaboratorsAffected: 1 })),
  ];
  showAccount();
  const trigger = await screen.findByTestId('account-row-delete-account');
  fireEvent.click(trigger);
  await waitFor(() => expect(requests.filter((request) => request.path === '/api/account' && request.method === 'GET')).toHaveLength(1));
  fireEvent.click(screen.getByTestId('confirm-modal-cancel'));
  fireEvent.click(trigger);
  await waitFor(() => expect(requests.filter((request) => request.path === '/api/account' && request.method === 'GET')).toHaveLength(2));
  expect(await screen.findByText(/你的 2 個行程/)).toBeVisible();
  await act(async () => { resolveOld(json({ hasPassword: false, tripsOwned: 99, collaboratorsAffected: 80 })); });
  expect(screen.getByText(/你的 2 個行程/)).toBeVisible();
  expect(screen.queryByText(/99 個行程/)).toBeNull();
});
