/**
 * ChatPage AI 資料同意閘門（spec #1553、ADR-0012；就地 sheet A）。鎖：
 *   - enforced 且未同意 → 送出不 POST /requests、跳資料同意 sheet、輸入保留；同意後續送原訊息
 *   - 暫不使用 → 不 POST /requests、輸入保留
 *   - 後端以 AI_CONSENT_OWNER_REQUIRED 擋下（旅伴）→ 移除樂觀訊息、輸入還原、跳 owner-missing（沒有同意鈕）
 *   - enforced=false → 與沒有此功能時相同（直接送出）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' },
    reload: () => {},
  }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' },
    reload: () => {},
  }),
}));
// 可控 SSE 狀態：預設 null（既有 gate 測試不受影響），SSE-failed 測試就地改 sse.status。
const sse = vi.hoisted(() => ({ status: null as 'completed' | 'failed' | null, error: null as string | null }));
vi.mock('../../src/hooks/useRequestSSE', () => ({
  useRequestSSE: () => sse,
}));

const apiFetchMock = vi.fn();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, opts?: { method?: string }) => apiFetchMock(path, opts),
}));

import ChatPage from '../../src/pages/ChatPage';

import { ApiError } from '../../src/lib/errors';

const TEXT = { version: 'ai-data-v1', title: '讓 AI 協助安排你的行程？', intro: '說明', sections: [{ heading: '我們會交給 AI 的資料', items: ['行程內容'] }], withdrawal: ['w'] };
let consentState: Record<string, unknown>;
let postRejects: ApiError | null;
let isOwner = true;
function installMock(enforced: boolean, status = 'none') {
  isOwner = true;
  consentState = { status, currentVersion: 'ai-data-v1', acceptedVersion: null, acceptedAt: null, text: TEXT, enforced };
  postRejects = null;
  apiFetchMock.mockImplementation((path: string, opts?: { method?: string }) => {
    if (path === '/account/ai-authorization') return Promise.resolve({ authorized: true });
    if (path === '/trips/okinawa-2026/ai-authorization') return Promise.resolve({ ownerAuthorized: true, isOwner });
    if (path === '/account/ai-data-consent') {
      if (opts?.method === 'POST') consentState = { ...consentState, status: 'valid', acceptedVersion: 'ai-data-v1' };
      return Promise.resolve(consentState);
    }
    if (path === '/requests' && opts?.method === 'POST') return postRejects ? Promise.reject(postRejects) : Promise.resolve({ id: 99 });
    if (path.startsWith('/requests')) return Promise.resolve({ items: [], hasMore: false });
    if (path === '/my-trips') return Promise.resolve([{ tripId: 'okinawa-2026' }]);
    if (path.startsWith('/trips')) return Promise.resolve([{ tripId: 'okinawa-2026', name: '沖繩 2026', title: '沖繩 2026', countries: 'JP' }]);
    return Promise.resolve(null);
  });
}
const requestPosts = () => apiFetchMock.mock.calls.filter(([p, o]: [string, { method?: string }?]) => p === '/requests' && o?.method === 'POST');
const consentCalls = (m: string) => apiFetchMock.mock.calls.filter(([p, o]: [string, { method?: string }?]) => p === '/account/ai-data-consent' && (o?.method ?? 'GET') === m);
function renderPage() {
  return render(<MemoryRouter initialEntries={['/chat?tripId=okinawa-2026']}><ChatPage /></MemoryRouter>);
}
async function typeAndSend(text: string) {
  const input = (await screen.findByTestId('chat-input')) as HTMLTextAreaElement;
  await waitFor(() => expect(input.disabled).toBe(false));
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByTestId('chat-send'));
}
beforeEach(() => { apiFetchMock.mockReset(); sse.status = null; });
const ready = () => waitFor(() => expect(consentCalls('GET').length).toBeGreaterThan(0));

describe('ChatPage AI 資料同意閘門', () => {
  it('enforced 且未同意：送出不 POST /requests，跳 sheet；同意後 POST 同意再續送原訊息', async () => {
    installMock(true);
    renderPage(); await ready();
    await typeAndSend('把第三天晚餐改海鮮');
    expect(await screen.findByTestId('ai-data-consent-sheet')).toBeTruthy();
    expect(requestPosts()).toHaveLength(0);
    expect((screen.getByTestId('chat-input') as HTMLTextAreaElement).value).toBe('把第三天晚餐改海鮮');
    fireEvent.click(screen.getByTestId('ai-data-consent-accept'));
    await waitFor(() => expect(requestPosts()).toHaveLength(1));
    expect(consentCalls('POST')).toHaveLength(1);
    expect(JSON.parse(requestPosts()[0][1].body).message).toBe('把第三天晚餐改海鮮');
    await waitFor(() => expect(screen.queryByTestId('ai-data-consent-sheet')).toBeNull());
  });

  it('同意 API 失敗：sheet 保留並顯示錯誤、不 POST /requests、輸入保留（可重試）', async () => {
    installMock(true);
    const base = apiFetchMock.getMockImplementation()!;
    apiFetchMock.mockImplementation((path: string, opts?: { method?: string }) =>
      path === '/account/ai-data-consent' && opts?.method === 'POST' ? Promise.reject(new Error('boom')) : base(path, opts));
    renderPage(); await ready();
    await typeAndSend('把第三天晚餐改海鮮');
    fireEvent.click(await screen.findByTestId('ai-data-consent-accept'));
    expect((await screen.findByTestId('ai-data-consent-error')).textContent).toContain('同意失敗');
    expect(screen.getByTestId('ai-data-consent-sheet')).toBeTruthy();
    expect(requestPosts()).toHaveLength(0);
    expect((screen.getByTestId('chat-input') as HTMLTextAreaElement).value).toBe('把第三天晚餐改海鮮');
  });

  it('暫不使用：不 POST /requests、sheet 關閉、輸入保留', async () => {
    installMock(true);
    renderPage(); await ready();
    await typeAndSend('把第三天晚餐改海鮮');
    fireEvent.click(await screen.findByTestId('ai-data-consent-decline'));
    await waitFor(() => expect(screen.queryByTestId('ai-data-consent-sheet')).toBeNull());
    expect(requestPosts()).toHaveLength(0);
    expect((screen.getByTestId('chat-input') as HTMLTextAreaElement).value).toBe('把第三天晚餐改海鮮');
  });

  it('後端回 AI_CONSENT_OWNER_REQUIRED（owner 沒同意）：跳 owner-missing、沒有同意鈕、輸入還原、不留「送出失敗」', async () => {
    installMock(true, 'valid');
    renderPage(); await ready();
    postRejects = new ApiError('AI_CONSENT_OWNER_REQUIRED', 403);
    await typeAndSend('把第三天晚餐改海鮮');
    expect(await screen.findByText('暫時無法使用 AI 助理')).toBeTruthy();
    expect(screen.queryByTestId('ai-data-consent-accept')).toBeNull();
    expect((screen.getByTestId('chat-input') as HTMLTextAreaElement).value).toBe('把第三天晚餐改海鮮');
    expect(screen.queryByText(/送出失敗/)).toBeNull();
  });

  it('旅伴（非 owner）自己沒同意：不跳 sheet、直接送出（旅伴免同意，由 owner 的同意把關）', async () => {
    installMock(true);
    isOwner = false;
    renderPage(); await ready();
    await waitFor(() => expect(apiFetchMock.mock.calls.some(([p]: [string]) => p === '/trips/okinawa-2026/ai-authorization')).toBe(true));
    await typeAndSend('把第三天晚餐改海鮮');
    await waitFor(() => expect(requestPosts()).toHaveLength(1));
    expect(screen.queryByTestId('ai-data-consent-sheet')).toBeNull();
  });

  it('enforced=false：直接送出、不跳 sheet', async () => {
    installMock(false);
    renderPage(); await ready();
    await typeAndSend('把第三天晚餐改海鮮');
    await waitFor(() => expect(requestPosts()).toHaveLength(1));
    expect(screen.queryByTestId('ai-data-consent-sheet')).toBeNull();
  });

  it('已同意（valid）：直接送出', async () => {
    installMock(true, 'valid');
    renderPage(); await ready();
    await typeAndSend('x');
    await waitFor(() => expect(requestPosts()).toHaveLength(1));
    expect(screen.queryByTestId('ai-data-consent-sheet')).toBeNull();
  });
});
