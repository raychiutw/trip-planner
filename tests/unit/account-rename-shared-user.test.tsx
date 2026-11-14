/**
 * 改名成功後共享的使用者必須失效（#1691 的共享結果有 30 秒 TTL）：
 * 之後才 mount 的 useCurrentUser（例如切頁後的側邊欄）要拿到新名字，且確實重新問過 userinfo。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

import AccountPage from '../../src/pages/AccountPage';
import { useCurrentUser } from '../../src/hooks/useCurrentUser';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let name: string;
let userinfoCalls: number;

beforeEach(() => {
  name = 'Ray';
  userinfoCalls = 0;
  window.scrollTo = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'https://test').pathname;
    if (path === '/api/oauth/userinfo') { userinfoCalls++; return json({ id: 'u1', email: 'ray@example.test', emailVerified: true, displayName: name, avatarUrl: null, createdAt: '' }); }
    if (path === '/api/account/profile' && init?.method === 'PATCH') { name = JSON.parse(String(init.body)).displayName; return json({ displayName: name }); }
    if (path === '/api/account/stats') return json({ tripCount: 1, totalDays: 1, collaboratorCount: 0 });
    if (path === '/api/account') return json({ hasPassword: true, tripsOwned: 0, collaboratorsAffected: 0 });
    return json({});
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('改名後的共享使用者', () => {
  it('改名成功 → 之後 mount 的 useCurrentUser 拿到新名字，且有發出新的 userinfo 請求', async () => {
    render(<MemoryRouter initialEntries={['/account']}><AccountPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('account-hero').textContent).toContain('Ray'));
    const before = userinfoCalls;
    fireEvent.click(screen.getByTestId('account-edit-name-btn'));
    const input = await screen.findByTestId('account-edit-name-input');
    fireEvent.change(input, { target: { value: '新名字' } });
    fireEvent.blur(input);
    await waitFor(() => expect(screen.getByTestId('account-hero').textContent).toContain('新名字'));
    // 模擬切頁後才 mount 的側邊欄
    const later = renderHook(() => useCurrentUser());
    await waitFor(() => expect(later.result.current.user?.displayName).toBe('新名字'));
    expect(userinfoCalls).toBeGreaterThan(before);
  });
});
