/** 帳號頁「變更密碼」入口：只有有 local 密碼的帳號才顯示（flutter#529）。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
  apiFetchRaw: vi.fn(),
}));
vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ user: { id: 'u1', email: 'ray@x.com', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' }, reload: () => {} }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', email: 'ray@x.com', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' }, reload: () => {} }),
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

import AccountPage from '../../src/pages/AccountPage';

const preview = (hasPassword: boolean) => ({
  hasPassword, tripsOwned: 0, collaboratorsAffected: 0,
});
function setup(accountResult: () => Promise<unknown>) {
  apiFetchMock.mockImplementation((path) => (path === '/account' ? accountResult() : Promise.resolve({ tripCount: 0, totalDays: 0, collaboratorCount: 0 })));
  return render(<MemoryRouter initialEntries={['/account']}><AccountPage /></MemoryRouter>);
}
const row = () => screen.queryByText('變更密碼');

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('AccountPage 的變更密碼入口', () => {
  it('有 local 密碼：顯示，連到 /account/password', async () => {
    setup(() => Promise.resolve(preview(true)));
    await waitFor(() => expect(row()).not.toBeNull());
    expect(row()!.closest('a')?.getAttribute('href')).toBe('/account/password');
  });

  it('只用 Google 登入（沒有密碼）：不顯示', async () => {
    setup(() => Promise.resolve(preview(false)));
    await waitFor(() => expect(apiFetchMock.mock.calls.some((c) => c[0] === '/account')).toBe(true));
    await new Promise((r) => setTimeout(r, 20));
    expect(row()).toBeNull();
  });

  it('預覽取不到：入口位置顯示錯誤與「重試」，其餘功能不受影響；重試成功後入口出現', async () => {
    let attempt = 0;
    setup(() => (attempt++ === 0 ? Promise.reject(new Error('boom')) : Promise.resolve(preview(true))));
    const retry = await screen.findByTestId('account-preview-retry');
    expect(row()).toBeNull();
    expect(screen.getByTestId('account-page')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('無法確認');
    fireEvent.click(retry);
    await waitFor(() => expect(row()).not.toBeNull());
    expect(screen.queryByTestId('account-preview-retry')).toBeNull();
  });

  it('只打一次 GET /account：入口與刪除預覽共用同一個請求', async () => {
    setup(() => Promise.resolve(preview(true)));
    await waitFor(() => expect(row()).not.toBeNull());
    expect(apiFetchMock.mock.calls.filter((c) => c[0] === '/account')).toHaveLength(1);
  });

  it('刪除確認每次開啟都重取最新預覽：新數字出現、舊數字不得出現', async () => {
    let n = 0;
    setup(() => Promise.resolve({ ...preview(true), tripsOwned: ++n === 1 ? 11 : 22 }));
    await waitFor(() => expect(row()).not.toBeNull());
    fireEvent.click(screen.getByTestId('account-row-delete-account'));
    await screen.findByText(/你的 22 個行程會一併刪除/);
    expect(screen.queryByText(/你的 11 個行程/)).toBeNull();
    expect(apiFetchMock.mock.calls.filter((c) => c[0] === '/account')).toHaveLength(2);
  });

  it('預覽載入中就開刪除確認：只打一次請求（等同一個）', async () => {
    let resolve!: (v: unknown) => void;
    setup(() => new Promise((r) => { resolve = r; }));
    await waitFor(() => expect(apiFetchMock.mock.calls.some((c) => c[0] === '/account')).toBe(true));
    fireEvent.click(screen.getByTestId('account-row-delete-account'));
    resolve({ ...preview(true), tripsOwned: 3 });
    await screen.findByText(/你的 3 個行程會一併刪除/);
    expect(apiFetchMock.mock.calls.filter((c) => c[0] === '/account')).toHaveLength(1);
  });

  it('取不到最新預覽：刪除確認顯示錯誤、確認鈕不可按；入口與其他功能不受影響（不出現重試列）', async () => {
    let n = 0;
    setup(() => (++n === 1 ? Promise.resolve(preview(true)) : Promise.reject(new Error('boom'))));
    await waitFor(() => expect(row()).not.toBeNull());
    fireEvent.click(screen.getByTestId('account-row-delete-account'));
    await screen.findByText(/無法確認刪除影響範圍/);
    expect((screen.getByTestId('confirm-modal-confirm') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/一併刪除/)).toBeNull();
    expect(row()).not.toBeNull();
    expect(screen.queryByTestId('account-preview-retry')).toBeNull();
  });

  it('靜態重試列的 hover 覆寫排在一般列 hover 之後（同 specificity，後者才贏）', async () => {
    const src = (await import('../../src/pages/AccountPage?raw')).default as string;
    const normal = src.indexOf('.tp-account-row:hover');
    const stat = src.indexOf('.tp-account-row-static:hover');
    expect(normal).toBeGreaterThan(-1);
    expect(stat).toBeGreaterThan(normal);
  });
});
