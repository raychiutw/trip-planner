/**
 * ChatPage AI 授權 gate（Option E queue-jam 修復 Part A）。鎖：
 *   - owner 未授權（GET /account/ai-authorization → authorized:false）時送出 → 不 POST /requests，
 *     改跳 AiConsentSheet（避免建一筆 mint 不出 token 的死請求卡佇列）
 *   - sheet 點「授權並送出」→ POST /account/ai-authorization → 續 POST /requests
 *   - sheet 點「取消」→ 不 POST /requests、輸入保留
 *
 * ChatPage mount 含多個 effect（SSE / history / trip auto-select），沿用 chat-page-ai-avatar
 * 的 stub 手法，另把 apiFetch mock 改為轉發 (path, opts) 以分辨 GET/POST。
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

function installMock(authorized: boolean) {
  apiFetchMock.mockImplementation((path: string, opts?: { method?: string }) => {
    if (path === '/account/ai-authorization') {
      // GET → 目前授權狀態；POST → 建立 Consent 後回已授權
      return Promise.resolve({ authorized: opts?.method === 'POST' ? true : authorized });
    }
    if (path.startsWith('/requests')) return Promise.resolve({ id: 99, items: [], hasMore: false });
    if (path === '/my-trips') return Promise.resolve([{ tripId: 'okinawa-2026' }]);
    if (path.startsWith('/trips')) return Promise.resolve([{ tripId: 'okinawa-2026', name: '沖繩 2026', title: '沖繩 2026', countries: 'JP' }]);
    return Promise.resolve(null);
  });
}

function requestPosts() {
  return apiFetchMock.mock.calls.filter(
    ([path, opts]: [string, { method?: string }?]) => path === '/requests' && opts?.method === 'POST',
  );
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/chat?tripId=okinawa-2026']}>
      <ChatPage />
    </MemoryRouter>,
  );
}

async function typeAndSend(text: string) {
  const input = (await screen.findByTestId('chat-input')) as HTMLTextAreaElement;
  await waitFor(() => expect(input.disabled).toBe(false));
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByTestId('chat-send'));
}

beforeEach(() => {
  apiFetchMock.mockReset();
  sse.status = null;
});

describe('ChatPage AI 授權 gate', () => {
  it('未授權送出 → 不 POST /requests、跳 AiConsentSheet', async () => {
    installMock(false);
    renderPage();
    // 等 mount GET /account/ai-authorization 結算 → aiAuthorized=false
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/account/ai-authorization', undefined));
    await typeAndSend('幫我排藏王三天兩夜');
    expect(await screen.findByTestId('ai-consent-sheet')).toBeTruthy();
    expect(screen.getByTestId('ai-consent-quoted').textContent).toContain('幫我排藏王三天兩夜');
    expect(requestPosts()).toHaveLength(0); // 關鍵：未建死請求
  });

  it('sheet 授權並送出 → POST ai-authorization 後續 POST /requests', async () => {
    installMock(false);
    renderPage();
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/account/ai-authorization', undefined));
    await typeAndSend('幫我排藏王三天兩夜');
    fireEvent.click(await screen.findByTestId('ai-consent-authorize'));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/account/ai-authorization', { method: 'POST' }));
    await waitFor(() => expect(requestPosts()).toHaveLength(1));
    expect(requestPosts()[0][1]).toMatchObject({ method: 'POST' });
  });

  it('sheet 取消 → 不 POST /requests、sheet 關閉、輸入保留', async () => {
    installMock(false);
    renderPage();
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/account/ai-authorization', undefined));
    await typeAndSend('幫我排藏王三天兩夜');
    fireEvent.click(await screen.findByTestId('ai-consent-cancel'));
    await waitFor(() => expect(screen.queryByTestId('ai-consent-sheet')).toBeNull());
    expect(requestPosts()).toHaveLength(0);
    expect((screen.getByTestId('chat-input') as HTMLTextAreaElement).value).toBe('幫我排藏王三天兩夜');
  });

  it('已授權送出 → 直接 POST /requests、不跳 sheet', async () => {
    installMock(true);
    renderPage();
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/account/ai-authorization', undefined));
    await typeAndSend('幫我排藏王三天兩夜');
    await waitFor(() => expect(requestPosts()).toHaveLength(1));
    expect(screen.queryByTestId('ai-consent-sheet')).toBeNull();
  });

  it('GET 授權狀態失敗 → fail-closed：送出跳 sheet、不建死請求（adversarial F2）', async () => {
    apiFetchMock.mockImplementation((path: string, opts?: { method?: string }) => {
      if (path === '/account/ai-authorization') {
        if (opts?.method === 'POST') return Promise.resolve({ authorized: true });
        return Promise.reject(new Error('network')); // GET 失敗 → fail-closed 成 false
      }
      if (path.startsWith('/requests')) return Promise.resolve({ id: 99, items: [], hasMore: false });
      if (path === '/my-trips') return Promise.resolve([{ tripId: 'okinawa-2026' }]);
      if (path.startsWith('/trips')) return Promise.resolve([{ tripId: 'okinawa-2026', name: '沖繩 2026', title: '沖繩 2026', countries: 'JP' }]);
      return Promise.resolve(null);
    });
    renderPage();
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/account/ai-authorization', undefined));
    await typeAndSend('幫我排藏王三天兩夜');
    expect(await screen.findByTestId('ai-consent-sheet')).toBeTruthy();
    expect(requestPosts()).toHaveLength(0);
  });

  it('sheet 授權失敗（POST reject）→ 顯錯誤、sheet 不關、不 POST /requests（gap 3）', async () => {
    apiFetchMock.mockImplementation((path: string, opts?: { method?: string }) => {
      if (path === '/account/ai-authorization') {
        if (opts?.method === 'POST') return Promise.reject(new Error('grant failed'));
        return Promise.resolve({ authorized: false });
      }
      if (path.startsWith('/requests')) return Promise.resolve({ id: 99, items: [], hasMore: false });
      if (path === '/my-trips') return Promise.resolve([{ tripId: 'okinawa-2026' }]);
      if (path.startsWith('/trips')) return Promise.resolve([{ tripId: 'okinawa-2026', name: '沖繩 2026', title: '沖繩 2026', countries: 'JP' }]);
      return Promise.resolve(null);
    });
    renderPage();
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/account/ai-authorization', undefined));
    await typeAndSend('幫我排藏王三天兩夜');
    fireEvent.click(await screen.findByTestId('ai-consent-authorize'));
    expect(await screen.findByTestId('ai-consent-error')).toBeTruthy();
    expect(screen.getByTestId('ai-consent-sheet')).toBeTruthy(); // 仍開、可重試
    expect(requestPosts()).toHaveLength(0);
  });

  it('SSE failed → 撈 /requests/:id 顯示後端 park 指引訊息（incident fix 核心，gap 1）', async () => {
    sse.status = 'failed'; // 送出後 setInflightId(99) 觸發 failed effect（inflightId 是 dep、status 已 failed）
    apiFetchMock.mockImplementation((path: string, opts?: { method?: string }) => {
      if (path === '/account/ai-authorization') return Promise.resolve({ authorized: true });
      if (path === '/requests' && opts?.method === 'POST') return Promise.resolve({ id: 99 });
      if (path === '/requests/99') return Promise.resolve({ reply: '這趟行程要用 AI 排程，需要行程擁有者先授權。' });
      if (path.startsWith('/requests')) return Promise.resolve({ items: [], hasMore: false });
      if (path === '/my-trips') return Promise.resolve([{ tripId: 'okinawa-2026' }]);
      if (path.startsWith('/trips')) return Promise.resolve([{ tripId: 'okinawa-2026', name: '沖繩 2026', title: '沖繩 2026', countries: 'JP' }]);
      return Promise.resolve(null);
    });
    renderPage();
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/account/ai-authorization', undefined));
    await typeAndSend('幫我排藏王三天兩夜');
    expect(await screen.findByText(/需要行程擁有者先授權/)).toBeTruthy();
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/requests/99', undefined));
  });

  it('SSE failed + 撈 reply 失敗 → 落用通用失敗訊息（gap 2）', async () => {
    sse.status = 'failed';
    apiFetchMock.mockImplementation((path: string, opts?: { method?: string }) => {
      if (path === '/account/ai-authorization') return Promise.resolve({ authorized: true });
      if (path === '/requests' && opts?.method === 'POST') return Promise.resolve({ id: 99 });
      if (path === '/requests/99') return Promise.reject(new Error('fetch fail'));
      if (path.startsWith('/requests')) return Promise.resolve({ items: [], hasMore: false });
      if (path === '/my-trips') return Promise.resolve([{ tripId: 'okinawa-2026' }]);
      if (path.startsWith('/trips')) return Promise.resolve([{ tripId: 'okinawa-2026', name: '沖繩 2026', title: '沖繩 2026', countries: 'JP' }]);
      return Promise.resolve(null);
    });
    renderPage();
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith('/account/ai-authorization', undefined));
    await typeAndSend('幫我排藏王三天兩夜');
    expect(await screen.findByText('AI 處理失敗，請換個說法或稍後再試。')).toBeTruthy();
  });
});
