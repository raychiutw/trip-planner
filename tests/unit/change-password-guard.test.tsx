/** /account/password 的進入守衛：旗標關閉、沒有 local 密碼、預覽失敗一律導回 /account（replace）。 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
}));
vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ user: { id: 'u1', email: 'ray@x.com' }, reload: () => {} }),
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import ChangePasswordPage from '../../src/pages/ChangePasswordPage';

const preview = (hasPassword: boolean) => ({
  hasPassword, reauthProvider: hasPassword ? null : 'google', reauthenticated: false, tripsOwned: 0, collaboratorsAffected: 0,
});
const renderPage = () => render(<MemoryRouter initialEntries={['/account/password']}><ChangePasswordPage /></MemoryRouter>);

beforeEach(() => {
  apiFetchMock.mockReset();
  navigateMock.mockReset();
  vi.stubEnv('VITE_NEW_API_AUTH', '1');
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('ChangePasswordPage 進入守衛', () => {
  it('有 local 密碼：顯示表單，不導走', async () => {
    apiFetchMock.mockResolvedValue(preview(true));
    renderPage();
    expect(await screen.findByTestId('change-password-page')).toBeTruthy();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('預覽載入中：不先閃出表單', () => {
    apiFetchMock.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.queryByTestId('change-password-page')).toBeNull();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('新 api 旗標關閉（舊入口沒有這個端點）：導回 /account，也不打 GET /account', async () => {
    vi.stubEnv('VITE_NEW_API_AUTH', '');
    apiFetchMock.mockResolvedValue(preview(true));
    renderPage();
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/account', { replace: true }));
    expect(screen.queryByTestId('change-password-page')).toBeNull();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('只用 Google 登入（hasPassword=false）：導回 /account', async () => {
    apiFetchMock.mockResolvedValue(preview(false));
    renderPage();
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/account', { replace: true }));
    expect(screen.queryByTestId('change-password-page')).toBeNull();
  });

  it('預覽取不到：導回 /account', async () => {
    apiFetchMock.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/account', { replace: true }));
    expect(screen.queryByTestId('change-password-page')).toBeNull();
  });
});
