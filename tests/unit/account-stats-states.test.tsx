/**
 * 帳號頁統計三態與請求逾時（#1688、#1686 診斷結論）：
 * 載入中＝骨架（不是「—」）、失敗＝警示列＋重試（放在統計區內）、成功＝數字；
 * 統計請求帶逾時 signal，逾時轉成失敗態而不是永遠 pending。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/logout', () => ({ logoutSession: vi.fn(async () => {}) }));
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
  apiFetchRaw: vi.fn(async () => new Response('{}')),
}));
const user = { id: 'u1', email: 'ray@x.com', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' };
vi.mock('../../src/hooks/useRequireAuth', () => ({ useRequireAuth: () => ({ user, reload: () => {} }) }));
vi.mock('../../src/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user, reload: () => {} }) }));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

import AccountPage from '../../src/pages/AccountPage';
import { ApiError } from '../../src/lib/errors';

const stats = { tripCount: 6, totalDays: 45, collaboratorCount: 2 };
const isStats = (p: string) => p === '/account/stats';
const statsCalls = () => apiFetchMock.mock.calls.filter(([p]) => isStats(p));

function renderPage() {
  render(<MemoryRouter initialEntries={['/account']}><AccountPage /></MemoryRouter>);
  return screen.getByRole('group', { name: '帳號統計' });
}

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (p) => (isStats(p) ? stats : {}));
});
afterEach(() => { vi.restoreAllMocks(); });

describe('統計三態', () => {
  it('載入中：骨架 + aria-busy + 視覺隱藏的「統計載入中」，不顯示「—」', () => {
    apiFetchMock.mockImplementation((p) => (isStats(p) ? new Promise(() => {}) : Promise.resolve({})));
    const group = renderPage();
    expect(group.getAttribute('aria-busy')).toBe('true');
    expect(within(group).getByRole('status')).toHaveTextContent('統計載入中');
    expect(group.querySelectorAll('.tp-account-skeleton')).toHaveLength(3);
    expect(group.textContent).not.toContain('—');
  });

  it('成功：顯示數字、無骨架、aria-busy=false', async () => {
    const group = renderPage();
    await waitFor(() => expect(group).toHaveTextContent('45'));
    expect(group.getAttribute('aria-busy')).toBe('false');
    expect(group.querySelectorAll('.tp-account-skeleton')).toHaveLength(0);
    expect(within(group).queryByRole('alert')).toBeNull();
  });

  it('失敗：警示列在統計區內、文案不重複、有重試且重試後轉成功', async () => {
    apiFetchMock.mockImplementation(async (p) => { if (isStats(p)) throw new ApiError('SYS_INTERNAL', 503); return {}; });
    const group = renderPage();
    const alert = await within(group).findByRole('alert');
    expect(alert.textContent).not.toContain('數據載入失敗');
    expect(alert.textContent).toContain('無法載入統計');
    expect(group.querySelectorAll('.tp-account-skeleton')).toHaveLength(0);
    expect(group.getAttribute('aria-busy')).toBe('false');

    apiFetchMock.mockImplementation(async (p) => (isStats(p) ? stats : {}));
    fireEvent.click(within(alert).getByRole('button', { name: '重試' }));
    await waitFor(() => expect(group).toHaveTextContent('45'));
    expect(within(group).queryByRole('alert')).toBeNull();
    expect(statsCalls()).toHaveLength(2);
  });
});

describe('統計請求逾時', () => {
  it('帶逾時 signal；逾時（abort）轉成失敗態', async () => {
    const ctl = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(ctl.signal);
    apiFetchMock.mockImplementation((p, init) => {
      if (!isStats(p)) return Promise.resolve({});
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(ApiError.fromNetworkError(new DOMException('timeout', 'TimeoutError'))));
      });
    });
    const group = renderPage();
    expect(timeout).toHaveBeenCalled();
    expect(statsCalls()[0]![1]?.signal).toBe(ctl.signal);
    expect(group.getAttribute('aria-busy')).toBe('true');
    ctl.abort();
    expect(await within(group).findByRole('alert')).toHaveTextContent('重試');
  });
});
