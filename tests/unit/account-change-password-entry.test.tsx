/** 帳號頁「變更密碼」入口：只有有 local 密碼的帳號才顯示（flutter#529）。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  hasPassword, reauthProvider: hasPassword ? null : 'google', reauthenticated: false, tripsOwned: 0, collaboratorsAffected: 0,
});
function setup(accountResult: () => Promise<unknown>) {
  apiFetchMock.mockImplementation((path) => (path === '/account' ? accountResult() : Promise.resolve({ tripCount: 0, totalDays: 0, collaboratorCount: 0 })));
  return render(<MemoryRouter initialEntries={['/account']}><AccountPage /></MemoryRouter>);
}
const row = () => screen.queryByText('變更密碼');

beforeEach(() => { apiFetchMock.mockReset(); });

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

  it('預覽取不到：不顯示，其餘功能不受影響', async () => {
    setup(() => Promise.reject(new Error('boom')));
    await waitFor(() => expect(apiFetchMock.mock.calls.some((c) => c[0] === '/account')).toBe(true));
    await new Promise((r) => setTimeout(r, 20));
    expect(row()).toBeNull();
    expect(screen.getByTestId('account-page')).toBeTruthy();
  });
});
