/**
 * 帳號刪除只走密碼確認（ADR-0009 已被取代，#1643）。Google 重新驗證已移除：
 * - 有密碼：DELETE 帶 { password }
 * - 無密碼（現實中不存在）：fail-closed —— 不能按下刪除、不送 DELETE、不導頁，顯示明確訊息
 *   （即使 api 的相容欄位仍回 reauthProvider:'google'／reauthenticated:true，也不能變成免驗證）
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../src/lib/auth', async (orig) => {
  const m = await orig<typeof import('../../src/lib/auth')>();
  return {
    ...m,
    // apiClient 走 getNewApiAuth().apiFetch；這裡轉成同一個被 stub 的 fetch，方便記錄請求
    getNewApiAuth: () => ({
      isAuthenticated: () => true,
      restoreSession: async () => true,
      apiFetch: (input: string | URL, init?: RequestInit) => fetch(String(input), init),
      login: async () => {}, refresh: async () => {}, logout: async () => {},
    }),
    getNewApiBase: () => 'https://api.test',
  };
});
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

import AccountPage from '../../src/pages/AccountPage';

const user = { id: 'u1', email: 'ray@example.test', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let preview: Record<string, unknown>;
let requests: { path: string; method: string; body: string | null }[];
let deleteResponse: Response;
let hrefSet: string[];

function setLocation(search = '') {
  hrefSet = [];
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname: '/account', search, hash: '', origin: 'https://web.test', assign: vi.fn(),
      set href(v: string) { hrefSet.push(v); }, get href() { return 'https://web.test/account' + search; } },
  });
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  requests = [];
  preview = { hasPassword: false, tripsOwned: 1, collaboratorsAffected: 0 };
  deleteResponse = json({ ok: true, tripsDeleted: 1 });
  window.scrollTo = vi.fn();
  setLocation();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'https://test').pathname;
    requests.push({ path, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : null });
    if (path === '/api/oauth/userinfo') return json(user);
    if (path === '/api/account/stats') return json({ tripCount: 1, totalDays: 1, collaboratorCount: 0 });
    if (path === '/api/account' && init?.method === 'DELETE') return deleteResponse;
    if (path === '/api/account') return json(preview);
    return json({});
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

const show = () => render(<MemoryRouter initialEntries={['/account']}><AccountPage /></MemoryRouter>);
const calls = (path: string, method: string) => requests.filter((r) => r.path === path && r.method === method);
async function openAndConfirm(text = 'DELETE') {
  fireEvent.click(await screen.findByTestId('account-row-delete-account'));
  fireEvent.change(await screen.findByTestId('delete-account-confirm-input'), { target: { value: text } });
  fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
}

const noDelete = () => expect(calls('/api/account', 'DELETE')).toHaveLength(0);

describe('無密碼帳號：fail-closed', () => {
  it.each([
    ['api 回舊相容欄位 google／false', { reauthProvider: 'google', reauthenticated: false }],
    ['api 回舊相容欄位 google／true（過去代表已重新驗證）', { reauthProvider: 'google', reauthenticated: true }],
    ['沒有任何相容欄位', {}],
  ])('%s → 顯示明確訊息、確認鈕停用、不送 DELETE、不導頁', async (_n, extra) => {
    preview = { ...preview, ...extra };
    show();
    fireEvent.click(await screen.findByTestId('account-row-delete-account'));
    expect(await screen.findByText('此帳號沒有設定密碼，無法在此刪除帳號。請聯絡客服協助。')).toBeVisible();
    const confirm = screen.getByTestId('confirm-modal-confirm');
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(screen.queryByTestId('delete-account-confirm-input')).toBeNull();
    noDelete();
    expect(hrefSet).toEqual([]);
  });

  it('回到 /account?deleteReauth=done 這種舊回跳網址也不會變成可刪除', async () => {
    setLocation('?deleteReauth=done');
    sessionStorage.setItem('tp-delete-challenge', 'ch-123');
    show();
    await screen.findByTestId('account-row-delete-account');
    noDelete();
    expect(screen.queryByTestId('delete-account-confirm-input')).toBeNull();
  });
});

describe('有密碼的帳號', () => {
  it('DELETE 帶 { password }', async () => {
    preview = { hasPassword: true, tripsOwned: 1, collaboratorsAffected: 0 };
    show();
    await openAndConfirm('my-password');
    await waitFor(() => expect(calls('/api/account', 'DELETE')).toHaveLength(1));
    expect(JSON.parse(calls('/api/account', 'DELETE')[0]!.body!)).toEqual({ password: 'my-password' });
    await waitFor(() => expect(hrefSet).toContain('/'));
  });

  it('密碼錯（ACCOUNT_DELETE_PASSWORD_INVALID）→ 標記欄位錯誤、不導頁', async () => {
    preview = { hasPassword: true, tripsOwned: 1, collaboratorsAffected: 0 };
    deleteResponse = json({ error: { code: 'ACCOUNT_DELETE_PASSWORD_INVALID' } }, 401);
    show();
    await openAndConfirm('wrong');
    await waitFor(() => expect(screen.getByTestId('delete-account-confirm-input')).toHaveAttribute('aria-invalid', 'true'));
    expect(hrefSet).toEqual([]);
  });
});
