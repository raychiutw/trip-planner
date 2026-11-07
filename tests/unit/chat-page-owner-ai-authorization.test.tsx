/**
 * ChatPage：旅伴送出前就知道「行程擁有者是否已授權 AI」（#1600）。鎖：
 *   - 旅伴 + 擁有者未授權 → 顯示「請行程擁有者授權」、送出被擋（不 POST /requests）、不跳授權視窗、不替擁有者授權
 *   - 旅伴 + 擁有者已授權 → 照常送出（即使旅伴自己沒授權）
 *   - 擁有者本人未授權 → 行為不變：跳授權視窗
 *   - 查詢被拒（非成員／失敗）→ 不攔，後端 mint 當最終關卡
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const USER = { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' };
vi.mock('../../src/hooks/useRequireAuth', () => ({ useRequireAuth: () => ({ user: USER, reload: () => {} }) }));
vi.mock('../../src/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: USER, reload: () => {} }) }));
vi.mock('../../src/hooks/useRequestSSE', () => ({ useRequestSSE: () => ({ status: null, error: null }) }));

const apiFetchMock = vi.fn();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, opts?: { method?: string }) => apiFetchMock(path, opts),
}));

import ChatPage from '../../src/pages/ChatPage';

type TripAuth = { ownerAuthorized: boolean; isOwner: boolean } | 'reject';
function install(self: boolean, trip: TripAuth) {
  apiFetchMock.mockImplementation((path: string, opts?: { method?: string }) => {
    if (path === '/account/ai-authorization') return Promise.resolve({ authorized: self });
    if (path === '/trips/okinawa-2026/ai-authorization') return trip === 'reject' ? Promise.reject(new Error('403')) : Promise.resolve(trip);
    if (path === '/account/ai-data-consent') return Promise.resolve({ status: 'none', currentVersion: 'v', acceptedVersion: null, acceptedAt: null, text: null, enforced: false });
    if (path === '/requests' && opts?.method === 'POST') return Promise.resolve({ id: 99 });
    if (path.startsWith('/requests')) return Promise.resolve({ items: [], hasMore: false });
    if (path === '/my-trips') return Promise.resolve([{ tripId: 'okinawa-2026' }]);
    if (path.startsWith('/trips')) return Promise.resolve([{ tripId: 'okinawa-2026', name: '沖繩 2026', title: '沖繩 2026', countries: 'JP' }]);
    return Promise.resolve(null);
  });
}
const calls = (path: string, method: string) =>
  apiFetchMock.mock.calls.filter(([p, o]: [string, { method?: string }?]) => p === path && (o?.method ?? 'GET') === method);
async function send(text: string) {
  const input = (await screen.findByTestId('chat-input')) as HTMLTextAreaElement;
  await waitFor(() => expect(input.disabled).toBe(false));
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByTestId('chat-send'));
}
async function renderReady() {
  render(<MemoryRouter initialEntries={['/chat?tripId=okinawa-2026']}><ChatPage /></MemoryRouter>);
  await waitFor(() => expect(calls('/account/ai-authorization', 'GET').length).toBeGreaterThan(0));
  await waitFor(() => expect(calls('/trips/okinawa-2026/ai-authorization', 'GET').length).toBeGreaterThan(0));
}
beforeEach(() => { apiFetchMock.mockReset(); });

describe('ChatPage 旅伴的擁有者授權提示', () => {
  it('旅伴 + 擁有者未授權：顯示請擁有者授權、擋下送出、不跳授權視窗、不替擁有者授權', async () => {
    install(true, { ownerAuthorized: false, isOwner: false });
    await renderReady();
    expect((await screen.findByTestId('chat-owner-unauthorized')).textContent).toContain('請行程擁有者授權');
    await send('把第三天晚餐改海鮮');
    expect(calls('/requests', 'POST')).toHaveLength(0);
    expect(screen.queryByTestId('ai-consent-sheet')).toBeNull();
    expect(calls('/account/ai-authorization', 'POST')).toHaveLength(0);
    expect((screen.getByTestId('chat-input') as HTMLTextAreaElement).value).toBe('把第三天晚餐改海鮮');
  });

  it('旅伴 + 旅伴自己沒授權但擁有者已授權：照常送出，不顯示提示', async () => {
    install(false, { ownerAuthorized: true, isOwner: false });
    await renderReady();
    await send('hi');
    await waitFor(() => expect(calls('/requests', 'POST')).toHaveLength(1));
    expect(screen.queryByTestId('chat-owner-unauthorized')).toBeNull();
    expect(screen.queryByTestId('ai-consent-sheet')).toBeNull();
  });

  it('擁有者本人未授權：行為不變，跳授權視窗，不顯示旅伴提示', async () => {
    install(false, { ownerAuthorized: false, isOwner: true });
    await renderReady();
    await send('hi');
    expect(await screen.findByTestId('ai-consent-sheet')).toBeTruthy();
    expect(screen.queryByTestId('chat-owner-unauthorized')).toBeNull();
    expect(calls('/requests', 'POST')).toHaveLength(0);
  });

  it('擁有者本人已授權：照常送出', async () => {
    install(true, { ownerAuthorized: true, isOwner: true });
    await renderReady();
    await send('hi');
    await waitFor(() => expect(calls('/requests', 'POST')).toHaveLength(1));
  });

  it('查詢被拒：不攔，照常送出（交給後端 mint 當最終關卡）', async () => {
    install(true, 'reject');
    await renderReady();
    await send('hi');
    await waitFor(() => expect(calls('/requests', 'POST')).toHaveLength(1));
    expect(screen.queryByTestId('chat-owner-unauthorized')).toBeNull();
  });
});
