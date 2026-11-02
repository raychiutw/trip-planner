/**
 * 帳號刪除的 fresh-auth（web，新 api 模式 VITE_NEW_API_AUTH=1）：
 * 新 api 沒有 cookie，無密碼帳號要先 POST /api/account/delete-reauth 拿 challenge，導去 Google 驗證，
 * 回到 /account?deleteReauth=done 後 DELETE /api/account 帶 { challengeId }（不是 { confirm }）。
 * 旗標關閉（舊入口）的行為必須完全不變。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const flag = vi.hoisted(() => ({ on: false }));
vi.mock('../../src/lib/auth', async (orig) => {
  const m = await orig<typeof import('../../src/lib/auth')>();
  return {
    ...m,
    isNewApiAuthEnabled: () => flag.on,
    // 新 api 模式：apiClient 走 getNewApiAuth().apiFetch；這裡轉成同一個被 stub 的 fetch，方便記錄請求
    getNewApiAuth: () => (flag.on ? {
      isAuthenticated: () => true,
      restoreSession: async () => true,
      apiFetch: (input: string | URL, init?: RequestInit) => fetch(String(input), init),
      login: async () => {}, refresh: async () => {}, logout: async () => {},
    } : null),
    getNewApiBase: () => 'https://api.test',
  };
});
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

import AccountPage from '../../src/pages/AccountPage';

const user = { id: 'u1', email: 'ray@example.test', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const KEY = 'tp-delete-challenge';

let preview: Record<string, unknown>;
let requests: { path: string; method: string; body: string | null }[];
let reauthResponse: Response;
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
  flag.on = true;
  sessionStorage.clear();
  localStorage.clear();
  requests = [];
  preview = { hasPassword: false, reauthProvider: 'google', reauthenticated: false, tripsOwned: 1, collaboratorsAffected: 0 };
  reauthResponse = json({ challengeId: 'ch-123', authorizeUrl: 'https://api.test/api/oauth/login/google?purpose=account-delete&challenge=ch-123', expiresIn: 300 });
  deleteResponse = json({ ok: true, tripsDeleted: 1 });
  window.scrollTo = vi.fn();
  setLocation();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'https://test').pathname;
    requests.push({ path, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : null });
    if (path === '/api/oauth/userinfo') return json(user);
    if (path === '/api/account/stats') return json({ tripCount: 1, totalDays: 1, collaboratorCount: 0 });
    if (path === '/api/account/delete-reauth' && init?.method === 'POST') return reauthResponse;
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

describe('新 api 模式：尚未重新驗證的無密碼帳號', () => {
  it('先 POST delete-reauth 拿 challenge、存進 sessionStorage、導向 api 回傳的 authorizeUrl；不送 DELETE', async () => {
    show();
    await openAndConfirm();
    await waitFor(() => expect(hrefSet).toEqual(['https://api.test/api/oauth/login/google?purpose=account-delete&challenge=ch-123']));
    expect(calls('/api/account/delete-reauth', 'POST')).toHaveLength(1);
    expect(sessionStorage.getItem(KEY)).toBe('ch-123');
    expect(calls('/api/account', 'DELETE')).toHaveLength(0);
  });

  it('delete-reauth 失敗 → 顯示錯誤、不導頁、不送 DELETE', async () => {
    reauthResponse = json({ error: { code: 'ACCOUNT_DELETE_REAUTH_REQUIRED' } }, 403);
    show();
    await openAndConfirm();
    expect(await screen.findByText('無法開始身分驗證，帳號尚未刪除。請稍後再試。')).toBeVisible();
    expect(hrefSet).toEqual([]);
    expect(calls('/api/account', 'DELETE')).toHaveLength(0);
  });
});

describe('新 api 模式：delete-reauth 回應格式不對', () => {
  it('200 但沒有 authorizeUrl → 視為失敗：不導頁（不會導去 undefined）、不存 challenge', async () => {
    reauthResponse = json({ challengeId: 'ch-123' });
    show();
    await openAndConfirm();
    expect(await screen.findByText('無法開始身分驗證，帳號尚未刪除。請稍後再試。')).toBeVisible();
    expect(hrefSet).toEqual([]);
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });
});

describe('新 api 模式：驗證完成回到 /account?deleteReauth=done', () => {
  beforeEach(() => {
    setLocation('?deleteReauth=done');
    preview = { ...preview, reauthenticated: true };
    sessionStorage.setItem(KEY, 'ch-123');
  });

  it('DELETE 帶 { challengeId }（不是 { confirm }），成功後清掉 sessionStorage 並整頁導向 /', async () => {
    show();
    fireEvent.change(await screen.findByTestId('delete-account-confirm-input'), { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    await waitFor(() => expect(calls('/api/account', 'DELETE')).toHaveLength(1));
    expect(JSON.parse(calls('/api/account', 'DELETE')[0]!.body!)).toEqual({ challengeId: 'ch-123' });
    await waitFor(() => expect(hrefSet).toContain('/'));
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('sessionStorage 沒有 challenge（被清掉）→ 不送 DELETE，要求重新驗證', async () => {
    sessionStorage.clear();
    show();
    fireEvent.change(await screen.findByTestId('delete-account-confirm-input'), { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    expect(await screen.findByText('近期身分驗證已失效，請重新驗證。帳號尚未刪除。')).toBeVisible();
    expect(calls('/api/account', 'DELETE')).toHaveLength(0);
  });

  it('api 回 ACCOUNT_DELETE_REAUTH_REQUIRED → 顯示重新驗證、清掉 challenge', async () => {
    deleteResponse = json({ error: { code: 'ACCOUNT_DELETE_REAUTH_REQUIRED' } }, 403);
    show();
    fireEvent.change(await screen.findByTestId('delete-account-confirm-input'), { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    expect(await screen.findByText('近期身分驗證已失效，請重新驗證。帳號尚未刪除。')).toBeVisible();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });
});

describe('新 api 模式：驗證失敗回到 /account?deleteReauth=failed', () => {
  it('顯示未完成訊息、清掉舊的 challenge、不送 DELETE', async () => {
    setLocation('?deleteReauth=failed');
    sessionStorage.setItem(KEY, 'ch-stale');
    show();
    expect(await screen.findByText('身分驗證未完成，帳號尚未刪除。請重新驗證。')).toBeVisible();
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(calls('/api/account', 'DELETE')).toHaveLength(0);
  });
});

describe('不受影響的路徑', () => {
  it('旗標關閉（舊入口）：仍導向 /api/oauth/login/google?purpose=account-delete，不打 delete-reauth', async () => {
    flag.on = false;
    show();
    await openAndConfirm();
    await waitFor(() => expect(hrefSet).toEqual(['/api/oauth/login/google?purpose=account-delete']));
    expect(calls('/api/account/delete-reauth', 'POST')).toHaveLength(0);
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('旗標關閉＋已驗證：DELETE 仍帶 { confirm }', async () => {
    flag.on = false;
    preview = { ...preview, reauthenticated: true };
    show();
    await openAndConfirm();
    await waitFor(() => expect(calls('/api/account', 'DELETE')).toHaveLength(1));
    expect(JSON.parse(calls('/api/account', 'DELETE')[0]!.body!)).toEqual({ confirm: 'DELETE' });
  });

  it('有密碼的帳號（新 api 模式）：DELETE 帶 { password }，不打 delete-reauth', async () => {
    preview = { hasPassword: true, reauthProvider: null, reauthenticated: false, tripsOwned: 1, collaboratorsAffected: 0 };
    show();
    await openAndConfirm('my-password');
    await waitFor(() => expect(calls('/api/account', 'DELETE')).toHaveLength(1));
    expect(JSON.parse(calls('/api/account', 'DELETE')[0]!.body!)).toEqual({ password: 'my-password' });
    expect(calls('/api/account/delete-reauth', 'POST')).toHaveLength(0);
  });
});
