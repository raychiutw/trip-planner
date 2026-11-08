/**
 * 邀請頁「切換帳號並繼續邀請」在新 api 模式（VITE_NEW_API_AUTH=1）：
 * 舊入口是一條 `<a href="/api/oauth/logout?redirect_after=…">` 的導覽，靠 cookie 登出。
 * 新 api 沒有 cookie，登出是受保護的 POST（導覽帶不了 bearer），所以改成：撤銷 token → 才導去登入頁。
 * 這條連結若仍是導覽，使用者會以為已切換，實際上新 api 的登入還在（回到邀請頁又是同一個帳號）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ logout: vi.fn(async () => {}), assign: vi.fn() }));
vi.mock('../../src/lib/auth', async (orig) => {
  const m = await orig<typeof import('../../src/lib/auth')>();
  return {
    ...m,
    isNewApiAuthEnabled: () => true,
    getNewApiBase: () => 'https://api.test',
    getNewApiAuth: () => ({
      isAuthenticated: () => true,
      restoreSession: async () => true,
      apiFetch: (input: string | URL, init?: RequestInit) => fetch(String(input), init),
      login: async () => {}, refresh: async () => {}, logout: h.logout,
    }),
  };
});

import InvitePage from '../../src/pages/InvitePage';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  h.logout.mockClear();
  h.assign.mockClear();
  Object.defineProperty(window, 'location', { configurable: true, value: { pathname: '/invite', search: '?token=tk', assign: h.assign, origin: 'https://web.test' } });
  vi.stubGlobal('caches', undefined);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (/\/api\/invitations\?token/.test(String(url))) return json({ tripId: 't', tripTitle: '沖繩', invitedEmail: 'invitee@x.com', inviterDisplayName: 'Ray', inviterEmail: 'ray@x.com', expiresAt: '2030-01-01T00:00:00Z' });
    if (/\/api\/oauth\/userinfo/.test(String(url))) return json({ id: 'u', email: 'someone-else@x.com', emailVerified: true, displayName: 'S', avatarUrl: null, createdAt: '' });
    return json({}, 404);
  }));
});

describe('InvitePage 切換帳號（新 api）', () => {
  it('點擊：先撤銷新 api 的 token，再導去登入頁；不走舊入口的 /api/oauth/logout 導覽', async () => {
    render(<MemoryRouter initialEntries={['/invite?token=tk']}><InvitePage /></MemoryRouter>);
    const link = await screen.findByTestId('invite-switch-account');
    const notPrevented = fireEvent.click(link);
    expect(notPrevented).toBe(false); // preventDefault：不讓瀏覽器去導覽 /api/oauth/logout
    await waitFor(() => expect(h.assign).toHaveBeenCalledWith('/login?invitation=tk'));
    expect(h.logout).toHaveBeenCalledTimes(1);
    expect(h.logout.mock.invocationCallOrder[0]).toBeLessThan(h.assign.mock.invocationCallOrder[0]!);
  });
});
