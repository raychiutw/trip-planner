/**
 * ADR-0007 —「停止等待」鍵。
 *
 * 一送出就在，不依賴任何時鐘（elapsedMs 每次 mount 重新計時，用它當出現條件會讓
 * 重整後的殭屍又要再等 3 分鐘才給得出出口）。按下去只終結 request、放開 composer，
 * 不追殺 worker。
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
  useRequestSSE: (id: number | null) => ({
    status: id ? 'processing' : null,
    processedBy: null,
    error: null,
    errorReason: null,
    isConnected: true,
    elapsedMs: 0,
  }),
}));

const apiFetchMock = vi.fn();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
}));

import ChatPage from '../../src/pages/ChatPage';

const PENDING_ROW = {
  id: 42,
  tripId: 'okinawa-2026',
  message: 'Day 1 加水族館',
  reply: null,
  status: 'processing' as const,
  terminalReason: null,
  createdAt: '2026-07-28T08:00:00',
  updatedAt: null,
};

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((path: string) => {
    if (path.startsWith('/requests/')) return Promise.resolve({ ...PENDING_ROW, status: 'failed', terminalReason: 'cancelled' });
    if (path.startsWith('/requests')) return Promise.resolve({ items: [PENDING_ROW], hasMore: false });
    if (path === '/my-trips') {
      return Promise.resolve([{ tripId: 'okinawa-2026', name: '沖繩 2026', title: '沖繩 2026', countries: 'JP' }]);
    }
    return Promise.resolve(null);
  });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/chat']}>
      {/* 一定要包 provider：沒有它時 useActiveTrip fallback 每次 render 回新的
          setActiveTrip 閉包，ChatPage 的 mount-only effect（dep 是它）就會無限
          重抓 /my-trips，act() 永遠等不到 render 靜止。產品端 provider 的 setter
          是 useCallback([]) 穩定，沒有這個問題。 */}
      <ActiveTripProvider>
        <ChatPage />
      </ActiveTripProvider>
    </MemoryRouter>,
  );
}

describe('ChatPage 停止等待 (ADR-0007)', () => {
  it('還在跑的請求旁邊就有「停止等待」鍵（不等 3 分鐘）', async () => {
    renderPage();
    expect(await screen.findByTestId('chat-stop-waiting')).toBeInTheDocument();
  });

  it('按下去 → PATCH 標 failed + cancelled', async () => {
    renderPage();
    const btn = await screen.findByTestId('chat-stop-waiting');
    await act(async () => { fireEvent.click(btn); });

    await waitFor(() => {
      const patch = apiFetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
      expect(patch).toBeDefined();
      expect(patch![0]).toBe('/requests/42');
      expect(JSON.parse(patch![1].body as string)).toEqual({ status: 'failed', terminalReason: 'cancelled' });
    });
  });

  it('按下去 → 泡泡改成已停止、composer 解鎖（殭屍不再鎖死整個聊天）', async () => {
    renderPage();
    const input = await screen.findByTestId('chat-input');
    expect(input).toBeDisabled();

    const stopBtn = await screen.findByTestId('chat-stop-waiting');
    await act(async () => { fireEvent.click(stopBtn); });

    await waitFor(() => expect(input).not.toBeDisabled());
    expect(screen.getByText(/已停止等待/)).toBeInTheDocument();
    expect(screen.queryByTestId('chat-stop-waiting')).not.toBeInTheDocument();
  });

  // 真瀏覽器自測抓到的：停止後泡泡被畫成 is-failed（destructive 紅框紅字）。
  // 使用者自己按的停止不是錯誤，HIG 上不該用 destructive 色。
  it('停止後的泡泡是中性態，不是 destructive 錯誤態', async () => {
    renderPage();
    const stopBtn = await screen.findByTestId('chat-stop-waiting');
    await act(async () => { fireEvent.click(stopBtn); });

    const bubble = await waitFor(() => {
      const el = screen.getByText(/已停止等待/).closest('.tp-chat-msg');
      expect(el).not.toBeNull();
      return el!;
    });
    expect(bubble.className).toContain('is-terminated');
    expect(bubble.className).not.toContain('is-failed');
  });
});
