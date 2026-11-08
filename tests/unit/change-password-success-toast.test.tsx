/**
 * #1589：變更密碼成功後導回 /account，成功 Toast 必須真的看得到。
 * 不 mock Toast、不 mock useNavigate——走真實的路由與 Toast 容器，
 * 之前單元測試只驗 showToast 被呼叫，所以沒抓到「沒有容器可顯示」。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
  apiFetchRaw: () => Promise.resolve(new Response('{}')),
}));
const USER = { id: 'u1', email: 'ray@x.com', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' };
vi.mock('../../src/hooks/useRequireAuth', () => ({ useRequireAuth: () => ({ user: USER, reload: () => {} }) }));
vi.mock('../../src/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: USER, reload: () => {} }) }));
vi.mock('../../src/hooks/useAccountPreview', () => ({
  useAccountPreview: () => ({ status: 'ready', preview: { hasPassword: true }, reload: vi.fn(), patch: vi.fn() }),
}));
vi.mock('../../src/lib/auth', async (orig) => {
  const m = await orig<typeof import('../../src/lib/auth')>();
  return { ...m, getNewApiAuth: () => ({ isAuthenticated: () => true, logout: vi.fn() }) };
});
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

import ChangePasswordPage from '../../src/pages/ChangePasswordPage';
import AccountPage from '../../src/pages/AccountPage';
import { resetToasts } from '../../src/components/shared/Toast';

beforeEach(() => {
  cleanup();
  resetToasts();
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (path) => (path === '/account/password' ? { ok: true } : {}));
});

describe('變更密碼成功回饋可見（#1589）', () => {
  it('成功後導回 /account，畫面上只出現一則「密碼已更新，其他裝置已登出」', async () => {
    render(
      <MemoryRouter initialEntries={['/account/password']}>
        <Routes>
          <Route path="/account/password" element={<ChangePasswordPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByTestId('change-password-current'), { target: { value: 'old-password-12345' } });
    fireEvent.change(screen.getByTestId('change-password-new'), { target: { value: 'brand-new-pass-678' } });
    fireEvent.click(screen.getByTestId('change-password-submit'));
    await waitFor(() => expect(screen.getByTestId('account-page')).toBeTruthy());
    expect(await screen.findAllByText('密碼已更新，其他裝置已登出')).toHaveLength(1);
  });
});
