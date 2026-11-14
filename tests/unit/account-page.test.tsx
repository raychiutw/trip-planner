/**
 * AccountPage unit test — Section 2 (terracotta-account-hub-page)
 *
 * 驗 mockup section 19 align：
 *   - hero (avatar + name + email + 3 stats)
 *   - 3 group settings rows: 應用程式 / 共編 & 整合 / 帳號
 *   - row Link to= /account/appearance / /account/notifications / /settings/* /
 *     登出 (button onClick → confirm modal)
 *   - logout confirm modal open + 確認 → logoutSession()（撤銷新 api 的 token，見 logout.ts）+ navigate /login
 *   - stats fetch /account/stats render values
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
const apiFetchRawMock = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>();
const logoutSessionMock = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../../src/lib/logout', () => ({ logoutSession: logoutSessionMock }));
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
  apiFetchRaw: (path: string, init?: RequestInit) => apiFetchRawMock(path, init),
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
import { ApiError } from '../../src/lib/errors';

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

  it('stats 非 ApiError（網路層）失敗 → 統計區警示列顯示「網路錯誤」文案與重試', async () => {
    apiFetchMock.mockReset();
    apiFetchMock.mockRejectedValue(new Error('boom'));
    renderPage();
    const alert = await within(screen.getByRole('group', { name: '帳號統計' })).findByRole('alert');
    expect(alert.textContent).toContain('網路錯誤，請稍後再試');
    expect(alert.textContent).toContain('重試');
  });

  it('stats ApiError 失敗 → 統計區警示列顯示「無法載入統計」', async () => {
    apiFetchMock.mockReset();
    apiFetchMock.mockRejectedValue(new ApiError('SYS_INTERNAL', 500));
    renderPage();
    const alert = await within(screen.getByRole('group', { name: '帳號統計' })).findByRole('alert');
    expect(alert.textContent).toContain('無法載入統計');
  });

  it('所有現有設定列都保留（以 origin/master 的列清單為準）', async () => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (p) => (p === '/account' ? { hasPassword: true, tripsOwned: 1, collaboratorsAffected: 0 } : { tripCount: 0, totalDays: 0, collaboratorCount: 0 }));
    renderPage();
    const keys = {
      application: ['appearance', 'notifications'],
      collab: ['connected-apps', 'developer'],
      account: ['change-password', 'sessions', 'privacy', 'logout', 'delete-account'],
    };
    await waitFor(() => expect(screen.getByTestId('account-row-change-password')).toBeTruthy());
    for (const [group, rows] of Object.entries(keys)) {
      const container = screen.getByTestId(`account-rows-${group}`);
      for (const k of rows) expect(within(container).getByTestId(`account-row-${k}`)).toBeTruthy();
      expect(container.querySelectorAll('[data-testid^="account-row-"]')).toHaveLength(rows.length);
    }
  });

  it('render 3 group settings rows: 應用程式 / 共編 & 整合 / 帳號', () => {
    renderPage();
    expect(screen.getByText('應用程式')).toBeTruthy();
    expect(screen.getByText('共編 & 整合')).toBeTruthy();
    // 「帳號」既是 TitleBar h1 也是 group label，兩處都該存在
    const matches = screen.getAllByText('帳號');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  // v2.54.10 依設定分區三色（mockup V1）：每組設定一色（user 拍板 sage↔pink 對調後）：
  // 應用程式=accent 柔褐、共編&整合=sage、帳號=pink。登出維持紅（.is-danger 覆寫）。
  it('group rows 依分區上 tone：應用程式=accent、共編&整合=sage、帳號=pink', () => {
    renderPage();
    expect(screen.getByTestId('account-rows-application').getAttribute('data-tone')).toBe('accent');
    expect(screen.getByTestId('account-rows-collab').getAttribute('data-tone')).toBe('sage');
    expect(screen.getByTestId('account-rows-account').getAttribute('data-tone')).toBe('pink');
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
    // 1c15055 fix: row to=/developer/apps (was /settings/developer-apps which 404'd —
    // canonical route per src/lib/routes.ts:36 developerApps())
    expect(screen.getByTestId('account-row-developer').getAttribute('href')).toBe('/developer/apps');
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

  it('confirm logout → logoutSession() + navigate /login', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('account-row-logout'));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    await waitFor(() => expect(logoutSessionMock).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      // v2.33.47 round 7b: navigate 改 { replace: true } 不留 history entry
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
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
