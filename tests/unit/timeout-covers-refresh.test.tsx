/**
 * 走「真的」apiFetch + 真的 auth client（token 端點永遠卡住）：
 * 帳號統計與側邊欄行程的逾時 signal 必須在 refresh 階段就能轉成失敗態（#1688 code-review）。
 * 其他測試 mock 了 apiFetch，抓不到「signal 沒傳進 refresh」這個洞。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const holder = vi.hoisted(() => ({ client: null as null | import('../../src/lib/auth/client').AuthClient }));
vi.mock('../../src/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/auth')>();
  return { ...actual, getNewApiAuth: () => holder.client!, getNewApiBase: () => 'https://api.test' };
});
vi.mock('../../src/lib/logout', () => ({ logoutSession: vi.fn(async () => {}) }));
const user = { id: 'u1', email: 'ray@x.com', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' };
vi.mock('../../src/hooks/useRequireAuth', () => ({ useRequireAuth: () => ({ user, reload: () => {} }) }));
vi.mock('../../src/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user, reload: () => {} }) }));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

import { createMemoryAuthStorage } from '../../src/lib/auth/storage';
import { createAuthClient } from '../../src/lib/auth/client';
import { createFakeOAuthApi, FAKE_API_BASE, FAKE_EMAIL, FAKE_PASSWORD } from './__helpers__/fake-oauth-api';
import AccountPage from '../../src/pages/AccountPage';
import { useMyTrips, __clearMyTripsCache } from '../../src/hooks/useMyTrips';

async function installColdClientWithHangingTokenEndpoint() {
  const api = createFakeOAuthApi();
  const storage = createMemoryAuthStorage();
  await createAuthClient({ apiBase: FAKE_API_BASE, storage, fetch: api.fetch }).login(FAKE_EMAIL, FAKE_PASSWORD);
  const gate = new Promise<never>(() => {});
  holder.client = createAuthClient({
    apiBase: FAKE_API_BASE, storage,
    fetch: async (input, init) => { if (String(input).includes('/api/oauth/token')) await gate; return api.fetch(input, init); },
  });
}

afterEach(() => { vi.restoreAllMocks(); __clearMyTripsCache(); });

describe('逾時涵蓋 refresh 階段（真 apiFetch）', () => {
  it('帳號統計：token 刷新卡住時，逾時一到就轉成失敗態＋重試', async () => {
    await installColdClientWithHangingTokenEndpoint();
    const ctl = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(ctl.signal);
    render(<MemoryRouter initialEntries={['/account']}><AccountPage /></MemoryRouter>);
    const group = screen.getByRole('group', { name: '帳號統計' });
    expect(group.getAttribute('aria-busy')).toBe('true');
    ctl.abort(new DOMException('timeout', 'TimeoutError'));
    expect(await within(group).findByRole('alert')).toHaveTextContent('重試');
  });

  it('側邊欄行程：token 刷新卡住時，逾時一到 status=error', async () => {
    await installColdClientWithHangingTokenEndpoint();
    const ctl = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(ctl.signal);
    const { result } = renderHook(() => useMyTrips('u1'));
    expect(result.current.status).toBe('loading');
    ctl.abort(new DOMException('timeout', 'TimeoutError'));
    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});
