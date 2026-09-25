import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AccountPage from '../../src/pages/AccountPage';
import AccountSheet from '../../src/components/shell/AccountSheet';
import { AccountSheetProvider } from '../../src/contexts/AccountSheetContext';

const user = { id: 'account-reader', email: 'reader@example.com', displayName: 'Reader', emailVerified: true };
const validPreview = { hasPassword: true, tripsOwned: 3, collaboratorsAffected: 2 };
let preview: unknown; let previewStatus: number; let statsStatus: number; let profileStatus: number;
let deleteStatus: number; let deleteCode: string; let writes: { path: string; body: unknown }[];
let previewRead: (() => Promise<Response>) | undefined;
let deleteResponse: Promise<Response> | undefined;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
beforeEach(() => {
  preview = validPreview; previewStatus = 200; statsStatus = 200; profileStatus = 200;
  deleteStatus = 401; deleteCode = 'ACCOUNT_DELETE_PASSWORD_INVALID'; writes = []; previewRead = undefined; deleteResponse = undefined;
  window.scrollTo = vi.fn(); localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'https://test').pathname;
    if (path === '/api/oauth/userinfo') return json(user);
    if (path === '/api/oauth/logout') return json({ error: { code: 'SYS_INTERNAL' } }, 500);
    if (path === '/api/account/stats') return json({ tripCount: 5, totalDays: 12, collaboratorCount: 2 }, statsStatus);
    if (path === '/api/account' && init?.method !== 'DELETE') return previewRead ? previewRead() : json(preview, previewStatus);
    if (init?.method === 'PATCH' || init?.method === 'DELETE') {
      writes.push({ path, body: JSON.parse(String(init.body)) });
      if (init.method === 'PATCH') return json(profileStatus === 200 ? { ...user, displayName: 'Updated' } : { error: 'DATA_VALIDATION', message: '名稱更新失敗' }, profileStatus);
      return deleteResponse ?? json({ error: { code: deleteCode } }, deleteStatus);
    }
    return json([]);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function open(sheet = false) {
  return render(<MemoryRouter initialEntries={['/account']}><AccountSheetProvider>
    {sheet ? <AccountSheet><AccountPage /></AccountSheet> : <AccountPage />}
  </AccountSheetProvider></MemoryRouter>);
}
async function openDelete() {
  const trigger = await screen.findByTestId('account-row-delete-account');
  const panel = document.querySelector('.account-sheet-panel');
  if (panel) await waitFor(() => expect(panel).toHaveFocus());
  trigger.focus(); fireEvent.click(trigger);
  return screen.findByRole('alertdialog');
}

describe('account recovery through the real page', () => {
  it.each([false, true])('failed preview allows cancel and restores focus, sheet=%s', async sheet => {
    previewStatus = 503; open(sheet); await openDelete();
    await screen.findByText('無法取得刪除影響範圍，請稍後再試');
    expect(screen.getByTestId('confirm-modal-confirm')).toBeDisabled();
    expect(screen.getByTestId('confirm-modal-cancel')).toBeEnabled();
    fireEvent.click(screen.getByTestId('confirm-modal-cancel'));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('account-row-delete-account')).toHaveFocus();
    expect(writes).toHaveLength(0);
  });
  it.each([false, true])('a rejected password keeps the account and allows correction, sheet=%s', async sheet => {
    open(sheet); await openDelete();
    const input = await screen.findByLabelText('請輸入密碼以確認');
    fireEvent.change(input, { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    await screen.findByText('密碼不正確，帳號未刪除');
    expect(screen.getByTestId('account-page')).toBeInTheDocument();
    expect(input).toBeEnabled();
    expect(writes).toEqual([{ path: '/api/account', body: { password: 'wrong-password' } }]);
  });
  it('malformed preview cannot substitute OAuth confirmation for password reauthentication', async () => {
    preview = { tripsOwned: 3, collaboratorsAffected: 2 }; open(); await openDelete();
    await screen.findByText('無法取得刪除影響範圍，請稍後再試');
    expect(screen.queryByTestId('delete-account-confirm-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('confirm-modal-confirm')).toBeDisabled();
  });
  it('a closed preview request cannot overwrite the next confirmation', async () => {
    let resolve!: (r: Response) => void;
    previewRead = () => new Promise(r => { resolve = r; });
    open(); await openDelete();
    fireEvent.click(screen.getByTestId('confirm-modal-cancel'));
    previewRead = undefined; preview = { ...validPreview, hasPassword: false, tripsOwned: 9 };
    await openDelete(); await screen.findByLabelText('請輸入 DELETE 以確認');
    await act(async () => resolve(json(validPreview)));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('9 個行程');
    expect(screen.getByLabelText('請輸入 DELETE 以確認')).toBeInTheDocument();
  });
  it('statistics failure remains unknown while a profile error retains the editable draft', async () => {
    statsStatus = 503; profileStatus = 400; open();
    await screen.findByText(/數據載入失敗/);
    expect(document.querySelectorAll('.tp-account-hero-stat-value')).toHaveLength(3);
    document.querySelectorAll('.tp-account-hero-stat-value').forEach(node => expect(node).toHaveTextContent('—'));
    fireEvent.click(screen.getByTestId('account-edit-name-btn'));
    const input = screen.getByRole('textbox', { name: '編輯名稱' });
    fireEvent.change(input, { target: { value: 'Updated' } }); fireEvent.blur(input);
    await waitFor(() => expect(input).toBeEnabled());
    expect(input).toHaveValue('Updated');
    expect(await screen.findByRole('alert')).toHaveTextContent(/更新失敗/);
    expect(writes).toHaveLength(1);
    profileStatus = 200; fireEvent.blur(input);
    await waitFor(() => expect(screen.queryByRole('textbox', { name: '編輯名稱' })).not.toBeInTheDocument());
    expect(screen.getByTestId('account-hero')).toHaveTextContent('Updated');
    statsStatus = 200; fireEvent.click(screen.getByRole('button', { name: '重試統計' }));
    await waitFor(() => expect(screen.queryByText(/數據載入失敗/)).not.toBeInTheDocument());
    expect(document.querySelector('.tp-account-hero-stat-value')).toHaveTextContent('5');
    profileStatus = 400; fireEvent.click(screen.getByTestId('account-edit-name-btn'));
    const nextInput = screen.getByRole('textbox', { name: '編輯名稱' });
    fireEvent.change(nextInput, { target: { value: 'Another name' } }); fireEvent.blur(nextInput);
    await screen.findByRole('alert');
    expect(screen.queryByText('名稱已更新')).not.toBeInTheDocument();
  });
  it('an in-flight deletion sends once and cannot look cancelled before its result', async () => {
    let resolve!: (r: Response) => void;
    deleteResponse = new Promise(r => { resolve = r; });
    open(); await openDelete();
    fireEvent.change(await screen.findByLabelText('請輸入密碼以確認'), { target: { value: 'password' } });
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-modal-cancel')).toBeDisabled();
    expect(writes).toHaveLength(1);
    await act(async () => resolve(json({ error: { code: 'ACCOUNT_DELETE_PASSWORD_INVALID' } }, 401)));
    expect(screen.getByTestId('confirm-modal-cancel')).toBeEnabled();
  });
  it('a rejected logout remains a recoverable operation instead of claiming success', async () => {
    open(); fireEvent.click(await screen.findByTestId('account-row-logout'));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    await screen.findByText('登出失敗，請稍後再試');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-modal-confirm')).toBeEnabled();
    expect(screen.getByTestId('account-page')).toBeInTheDocument();
  });
  it('IME confirmation does not save, Escape restores the name and focus without a write', async () => {
    open(); fireEvent.click(await screen.findByTestId('account-edit-name-btn'));
    const input = screen.getByRole('textbox', { name: '編輯名稱' });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: '還在組字' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 });
    expect(input).toHaveFocus(); expect(writes).toHaveLength(0);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByTestId('account-edit-name-btn')).toHaveFocus();
    expect(screen.getByTestId('account-hero')).toHaveTextContent('Reader');
    expect(writes).toHaveLength(0);
  });
  it.each([403, 500, 200])('OAuth deletion requires the exact phrase and rejects unconfirmed result %s', async code => {
    preview = { ...validPreview, hasPassword: false }; deleteStatus = code; deleteCode = 'PERM_DENIED';
    open(); await openDelete(); const input = await screen.findByLabelText('請輸入 DELETE 以確認');
    fireEvent.change(input, { target: { value: 'delete' } });
    expect(screen.getByTestId('confirm-modal-confirm')).toBeDisabled();
    fireEvent.change(input, { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    await screen.findByText('刪除失敗，請稍後再試');
    expect(writes).toEqual([{ path: '/api/account', body: { confirm: 'DELETE' } }]);
    expect(screen.getByTestId('confirm-modal-cancel')).toBeEnabled();
  });
});
