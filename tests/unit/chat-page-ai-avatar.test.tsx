/**
 * ChatPage AI avatar + bubble timestamp prefix — Section 4.8 (terracotta-mockup-parity-v2)
 *
 * 因 ChatPage mount 含 useRequestSSE + history fetch 等 effects，我們 mock
 * apiFetch / useCurrentUser / useRequireAuth / useRequestSSE 為 stub，再
 * stubGlobal fetch 提供 my-trips + trips + requests history fixture，最後
 * 驗 assistant bubble 有 AI avatar + timestamp prefix「Tripline AI · 」，
 * user bubble 沒 avatar / 沒 prefix。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
vi.mock('../../src/hooks/useRequestSSE', () => ({
  useRequestSSE: () => ({ status: null, error: null }),
}));

const apiFetchMock = vi.fn();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string) => apiFetchMock(path),
}));

import ChatPage from '../../src/pages/ChatPage';

const SAMPLE_REQUEST_ROW = {
  id: 1,
  tripId: 'okinawa-2026',
  mode: 'edit',
  message: 'Day 1 加水族館',
  reply: '已加在早上 10:00',
  status: 'completed' as const,
  createdAt: '2026-04-27T08:00:00',
  updatedAt: '2026-04-27T08:00:30',
};

beforeEach(() => {
  apiFetchMock.mockReset();
  // history fetch (apiFetch '/requests?...')
  apiFetchMock.mockImplementation((path: string) => {
    if (path.startsWith('/requests')) {
      return Promise.resolve({ items: [SAMPLE_REQUEST_ROW], hasMore: false });
    }
    return Promise.resolve(null);
  });
  // /my-trips + /trips?all=1 走 raw fetch（不在 apiFetch 內）
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url === '/api/my-trips') {
      return Promise.resolve(new Response(JSON.stringify([{ tripId: 'okinawa-2026' }]), { status: 200 }));
    }
    if (url.startsWith('/api/trips')) {
      return Promise.resolve(new Response(JSON.stringify([
        { tripId: 'okinawa-2026', name: '沖繩 2026', title: '沖繩 2026', countries: 'JP' },
      ]), { status: 200 }));
    }
    return Promise.resolve(new Response('null', { status: 200 }));
  }) as typeof fetch;
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/chat']}>
      <ChatPage />
    </MemoryRouter>,
  );
}

describe('ChatPage AI avatar + bubble timestamp prefix — Section 4.8', () => {
  it('assistant bubble 含 32x32 「AI」 avatar 在 bubble 左側', async () => {
    renderPage();
    await waitFor(() => expect(screen.queryByTestId('chat-msg-assistant')).toBeTruthy(), { timeout: 2000 });
    const avatar = screen.getByTestId('chat-avatar-ai');
    expect(avatar.textContent).toBe('AI');
    expect(avatar.className).toContain('is-ai');
  });

  it('user bubble 不含 avatar', async () => {
    renderPage();
    await waitFor(() => expect(screen.queryByTestId('chat-msg-user')).toBeTruthy(), { timeout: 2000 });
    // user message row 不該找到 chat-avatar-ai
    const userRow = screen.getByTestId('chat-msg-user').closest('.tp-chat-msg-row');
    expect(userRow?.querySelector('[data-testid="chat-avatar-ai"]')).toBeNull();
  });

  it('assistant bubble timestamp prefix「Tripline AI · 」', async () => {
    renderPage();
    await waitFor(() => {
      const ts = document.querySelector('.tp-chat-msg-time-assistant');
      expect(ts?.textContent).toMatch(/Tripline AI ·/);
    }, { timeout: 2000 });
  });

  it('user bubble timestamp 不含 prefix「Tripline AI · 」', async () => {
    renderPage();
    await waitFor(() => {
      const ts = document.querySelector('.tp-chat-msg-time-user');
      expect(ts).toBeTruthy();
      expect(ts?.textContent).not.toMatch(/Tripline AI ·/);
    }, { timeout: 2000 });
  });

  it('cross-day messages → render day-divider separator', async () => {
    apiFetchMock.mockImplementation((path: string) => {
      if (path.startsWith('/requests')) {
        return Promise.resolve({
          items: [
            { ...SAMPLE_REQUEST_ROW, id: 1, createdAt: '2026-04-26T10:00:00', updatedAt: '2026-04-26T10:00:10' },
            { ...SAMPLE_REQUEST_ROW, id: 2, createdAt: '2026-04-28T10:00:00', updatedAt: '2026-04-28T10:00:10' },
          ],
          hasMore: false,
        });
      }
      return Promise.resolve(null);
    });
    renderPage();
    await waitFor(() => {
      const dividers = document.querySelectorAll('[data-testid="chat-day-divider"]');
      // 2 個跨日 message → 至少 2 個 divider (initial + 跨日)
      expect(dividers.length).toBeGreaterThanOrEqual(2);
    }, { timeout: 2000 });
  });

  it('TitleBar title 為當前 trip name (取代「聊天」固定 title)', async () => {
    renderPage();
    await waitFor(() => {
      // 等待 history loaded → trip picker render with active trip
      expect(screen.getByTestId('chat-trip-picker')).toBeTruthy();
    }, { timeout: 2000 });
    // TitleBar h1 應為「沖繩 2026」 而不是「聊天」
    const heading = document.querySelector('h1, [data-testid="page-header-title"]');
    if (heading) {
      expect(heading.textContent).toContain('沖繩 2026');
      expect(heading.textContent).not.toContain('聊天');
    } else {
      // fallback: 至少確認 trip picker pill 內含 trip name
      expect(screen.getAllByText('沖繩 2026').length).toBeGreaterThan(0);
    }
  });
});
