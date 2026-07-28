/**
 * 聊天「捲到底」箭頭 + auto-scroll 讓位。
 *
 * 現況（修之前）：useChatPagination 的 auto-scroll 是無條件的
 * `if (lastChanged) el.scrollTop = el.scrollHeight` —— 你捲上去看歷史時，只要有
 * 新訊息進來就被硬拉回底部。既沒有「使用者已離開底部就別動」的守衛，也沒有任何
 * 「跳回最新」的控制項（全 src/ 零命中）。兩者是一組：不讓位就顯不出箭頭的需求，
 * 讓了位而沒箭頭就回不去。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';

vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' }, reload: () => {} }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' }, reload: () => {} }),
}));
vi.mock('../../src/hooks/useRequestSSE', () => ({
  useRequestSSE: () => ({ status: null, processedBy: null, error: null, errorReason: null, isConnected: false, elapsedMs: 0 }),
}));

const apiFetchMock = vi.fn();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
}));

import ChatPage from '../../src/pages/ChatPage';

function row(id: number) {
  return {
    id,
    tripId: 'okinawa-2026',
    message: `使用者訊息 ${id}`,
    reply: `AI 回覆 ${id}`,
    status: 'completed' as const,
    terminalReason: null,
    createdAt: `2026-07-29T0${id % 10}:00:00`,
    updatedAt: `2026-07-29T0${id % 10}:00:30`,
  };
}

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((path: string) => {
    if (path.startsWith('/requests')) {
      return Promise.resolve({ items: [row(1), row(2), row(3)], hasMore: true });
    }
    if (path === '/my-trips') {
      return Promise.resolve([{ tripId: 'okinawa-2026', name: '沖繩 2026', title: '沖繩 2026', countries: 'JP' }]);
    }
    // 沒有這行，consent gate 會擋掉送出 → 「不被拉回底部」那條會因為根本沒發生
    // 任何事而假綠（實測踩過）。
    if (path === '/account/ai-authorization') return Promise.resolve({ authorized: true });
    return Promise.resolve(null);
  });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/chat']}>
      <ActiveTripProvider>
        <ChatPage />
      </ActiveTripProvider>
    </MemoryRouter>,
  );
}

/** jsdom 的元素尺寸永遠是 0，手動裝出一個「可捲動且目前不在底部」的容器。 */
function makeScrolledUp(el: HTMLElement, { scrollTop }: { scrollTop: number }) {
  Object.defineProperty(el, 'scrollHeight', { value: 2000, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: 500, configurable: true });
  el.scrollTop = scrollTop;
}

describe('聊天捲到底箭頭', () => {
  it('停在底部時不顯示箭頭', async () => {
    renderPage();
    const body = await screen.findByTestId('chat-body');
    await act(async () => {
      makeScrolledUp(body, { scrollTop: 1500 }); // 1500 + 500 = 2000 = scrollHeight → 在底部
      fireEvent.scroll(body);
    });
    expect(screen.queryByTestId('chat-jump-to-latest')).not.toBeInTheDocument();
  });

  it('捲上去看歷史時顯示箭頭', async () => {
    renderPage();
    const body = await screen.findByTestId('chat-body');
    await act(async () => {
      makeScrolledUp(body, { scrollTop: 200 }); // 離底部 1300px
      fireEvent.scroll(body);
    });
    expect(await screen.findByTestId('chat-jump-to-latest')).toBeInTheDocument();
  });

  it('按下箭頭 → 捲到底且箭頭消失', async () => {
    renderPage();
    const body = await screen.findByTestId('chat-body');
    await act(async () => {
      makeScrolledUp(body, { scrollTop: 200 });
      fireEvent.scroll(body);
    });
    const btn = await screen.findByTestId('chat-jump-to-latest');
    await act(async () => { fireEvent.click(btn); });

    expect(body.scrollTop).toBe(2000);
    await waitFor(() => {
      expect(screen.queryByTestId('chat-jump-to-latest')).not.toBeInTheDocument();
    });
  });
});

describe('auto-scroll 讓位', () => {
  /*
   * 這一段是 mutation 抓出來補的：原本只測箭頭，把 auto-scroll 的守衛
   * （`lastChanged && atBottomRef.current`）改回無條件時三條測試照樣全綠 ——
   * 等於「修好了強制捲動」這件事沒有任何證明。
   */
  it('捲上去看歷史時送出新訊息，不會被硬拉回底部', async () => {
    renderPage();
    const body = await screen.findByTestId('chat-body');
    const input = await screen.findByTestId('chat-input');
    await waitFor(() => expect(input).not.toBeDisabled());

    await act(async () => {
      makeScrolledUp(body, { scrollTop: 200 });
      fireEvent.scroll(body);
    });
    expect(body.scrollTop).toBe(200);

    // 送出 → 樂觀插入 user + pending 兩個泡泡 → last id 變 → auto-scroll effect 觸發
    apiFetchMock.mockImplementation((path: string) => {
      if (path === '/requests') return Promise.resolve({ id: 999 });
      if (path.startsWith('/requests')) return Promise.resolve({ items: [row(1), row(2), row(3)], hasMore: true });
      if (path === '/my-trips') return Promise.resolve([{ tripId: 'okinawa-2026', name: '沖繩 2026', title: '沖繩 2026', countries: 'JP' }]);
      if (path === '/account/ai-authorization') return Promise.resolve({ authorized: true });
      return Promise.resolve(null);
    });
    await act(async () => {
      fireEvent.change(input, { target: { value: '在歷史位置打的字' } });
      fireEvent.click(screen.getByTestId('chat-send'));
    });

    // 先證明訊息真的送出去了（否則下面的斷言會因為「什麼都沒發生」而假綠）
    await waitFor(() => {
      expect(apiFetchMock.mock.calls.some(([p, i]) => p === '/requests' && i?.method === 'POST')).toBe(true);
    });
    expect(screen.getByText('在歷史位置打的字')).toBeInTheDocument();

    // 核心：仍停在 200，沒有被拉到 scrollHeight(2000)
    expect(body.scrollTop).toBe(200);
  });

  it('停在底部時送出新訊息，照樣自動拉到底', async () => {
    renderPage();
    const body = await screen.findByTestId('chat-body');
    const input = await screen.findByTestId('chat-input');
    await waitFor(() => expect(input).not.toBeDisabled());

    await act(async () => {
      makeScrolledUp(body, { scrollTop: 1500 }); // 在底部
      fireEvent.scroll(body);
    });

    apiFetchMock.mockImplementation((path: string) => {
      if (path === '/requests') return Promise.resolve({ id: 998 });
      if (path.startsWith('/requests')) return Promise.resolve({ items: [row(1), row(2), row(3)], hasMore: true });
      if (path === '/my-trips') return Promise.resolve([{ tripId: 'okinawa-2026', name: '沖繩 2026', title: '沖繩 2026', countries: 'JP' }]);
      if (path === '/account/ai-authorization') return Promise.resolve({ authorized: true });
      return Promise.resolve(null);
    });
    await act(async () => {
      fireEvent.change(input, { target: { value: '在底部打的字' } });
      fireEvent.click(screen.getByTestId('chat-send'));
    });

    await waitFor(() => {
      expect(screen.getByText('在底部打的字')).toBeInTheDocument();
    });
    expect(body.scrollTop).toBe(2000);
  });
});
