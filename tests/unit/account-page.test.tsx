/**
 * AccountPage unit test — Section 2 (terracotta-account-hub-page)
 *
 * 驗 mockup section 19 align：
 *   - hero (avatar + name + email + 3 stats)
 *   - 3 group settings rows: 應用程式 / 共編 & 整合 / 帳號
 *   - row Link to= /account/appearance / /account/notifications / /settings/* /
 *     登出 (button onClick → confirm modal)
 *   - logout confirm modal open + 確認 → POST /api/oauth/logout + navigate /login
 *   - stats fetch /account/stats render values
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
}));

vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    user: { id: 'u1', email: 'ray@x.com', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' },
    reload: () => {},
  }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', email: 'ray@x.com', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' },
    reload: () => {},
  }),
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import AccountPage from '../../src/pages/AccountPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/account']}>
      <AccountPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
  navigateMock.mockReset();
  // Default — empty stats so render 不 throw；個別 case overrides via mockResolvedValueOnce
  apiFetchMock.mockResolvedValue({ tripCount: 0, totalDays: 0, collaboratorCount: 0 });
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as typeof fetch;
});

describe('AccountPage', () => {
  it('render hero with avatar initial + displayName + email', async () => {
    apiFetchMock.mockResolvedValueOnce({ tripCount: 5, totalDays: 12, collaboratorCount: 3 });
    renderPage();
    expect(screen.getByTestId('account-page')).toBeTruthy();
    const hero = screen.getByTestId('account-hero');
    // avatar initial 'R'
    expect(hero.querySelector('.tp-account-hero-avatar')?.textContent).toBe('R');
    // name = displayName (Ray)
    expect(hero.querySelector('.tp-account-hero-name')?.textContent).toBe('Ray');
    expect(hero.textContent).toContain('ray@x.com');
  });

  it('hero stats fetch /account/stats + render value', async () => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({ tripCount: 7, totalDays: 21, collaboratorCount: 4 });
    renderPage();
    await waitFor(() => {
      expect(apiFetchMock.mock.calls.some((c) => c[0] === '/account/stats')).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByTestId('account-hero').textContent).toContain('7');
      expect(screen.getByTestId('account-hero').textContent).toContain('21');
      expect(screen.getByTestId('account-hero').textContent).toContain('4');
    });
  });

  it('stats 載入失敗 → 顯示「數據載入失敗」 status', async () => {
    apiFetchMock.mockReset();
    apiFetchMock.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/數據載入失敗/)).toBeTruthy();
    });
  });

  it('render 3 group settings rows: 應用程式 / 共編 & 整合 / 帳號', () => {
    renderPage();
    expect(screen.getByText('應用程式')).toBeTruthy();
    expect(screen.getByText('共編 & 整合')).toBeTruthy();
    // 「帳號」既是 TitleBar h1 也是 group label，兩處都該存在
    const matches = screen.getAllByText('帳號');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('每個 settings row 有對應 testid', () => {
    renderPage();
    expect(screen.getByTestId('account-row-appearance')).toBeTruthy();
    expect(screen.getByTestId('account-row-notifications')).toBeTruthy();
    expect(screen.getByTestId('account-row-connected-apps')).toBeTruthy();
    expect(screen.getByTestId('account-row-developer')).toBeTruthy();
    expect(screen.getByTestId('account-row-sessions')).toBeTruthy();
    expect(screen.getByTestId('account-row-logout')).toBeTruthy();
  });

  it('row Link href: appearance → /account/appearance, notifications → /account/notifications', () => {
    renderPage();
    expect(screen.getByTestId('account-row-appearance').getAttribute('href')).toBe('/account/appearance');
    expect(screen.getByTestId('account-row-notifications').getAttribute('href')).toBe('/account/notifications');
    expect(screen.getByTestId('account-row-connected-apps').getAttribute('href')).toBe('/settings/connected-apps');
    expect(screen.getByTestId('account-row-developer').getAttribute('href')).toBe('/settings/developer-apps');
    expect(screen.getByTestId('account-row-sessions').getAttribute('href')).toBe('/settings/sessions');
  });

  it('登出 row 是 button (有 onClick → 開 modal)，套 .is-danger', () => {
    renderPage();
    const logoutRow = screen.getByTestId('account-row-logout');
    expect(logoutRow.tagName).toBe('BUTTON');
    expect(logoutRow.className).toContain('is-danger');
  });

  it('click 登出 → confirm modal 開啟', () => {
    renderPage();
    expect(screen.queryByTestId('confirm-modal-confirm')).toBeNull();
    fireEvent.click(screen.getByTestId('account-row-logout'));
    expect(screen.getByTestId('confirm-modal-confirm')).toBeTruthy();
  });

  it('confirm logout → POST /api/oauth/logout + navigate /login', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('account-row-logout'));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/oauth/logout',
        expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
      );
    });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login');
    });
  });

  it('confirm modal 取消 button → modal 關閉，fetch 不被打', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('account-row-logout'));
    expect(screen.getByTestId('confirm-modal-confirm')).toBeTruthy();
    fireEvent.click(screen.getByText('取消'));
    expect(screen.queryByTestId('confirm-modal-confirm')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
