/**
 * ChatPage 訊息呈現 — 比照 App（chat_screen.dart _MessageBubble）：不用頭像，
 * 每則訊息上方一行名稱標籤（AI「Tripline AI」、自己＝帳號名、協作者＝對方名字），
 * 下方只剩時間（名稱不再重複在時間前面）。
 *
 * 因 ChatPage mount 含 useRequestSSE + history fetch 等 effects，我們 mock
 * apiFetch / useCurrentUser / useRequireAuth / useRequestSSE 為 stub，
 * 提供 my-trips + trips + requests history fixture。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const U = vi.hoisted(() => ({ displayName: 'Ray' }));

vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: U.displayName, avatarUrl: null, createdAt: '' },
    reload: () => {},
  }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: U.displayName, avatarUrl: null, createdAt: '' },
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

import ChatPage, { humanSenderLabel, sanitizeSenderName } from '../../src/pages/ChatPage';

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
  U.displayName = 'Ray';
  apiFetchMock.mockReset();
  // 2026-07-21：ChatPage 改為單抓 /my-trips（原本 /my-trips 只拿 id、名稱另抓
  // /trips?all=1，而那支對一般使用者降級成 published-only）。fixture 跟著改成
  // /my-trips 直接回完整資料 —— 這正是 prod 的實際 response shape。
  apiFetchMock.mockImplementation((path: string) => {
    if (path.startsWith('/requests')) {
      return Promise.resolve({ items: [SAMPLE_REQUEST_ROW], hasMore: false });
    }
    if (path === '/my-trips') {
      return Promise.resolve([
        { tripId: 'okinawa-2026', name: '沖繩 2026', title: '沖繩 2026', countries: 'JP' },
      ]);
    }
    return Promise.resolve(null);
  });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/chat']}>
      <ChatPage />
    </MemoryRouter>,
  );
}

describe('ChatPage 名稱標籤、無頭像、時間 — 比照 App', () => {
  // Value: protects=訊息不再出現頭像（使用者要求比照 App）; fails_when=任何角色又渲染 .tp-chat-avatar 或頭像 testid; why_new=取代原本「AI avatar 存在」的相反斷言; seam=none; no_claim=不含樣式
  it('任何角色都沒有頭像', async () => {
    renderPage();
    await waitFor(() => expect(screen.queryByTestId('chat-msg-assistant')).toBeTruthy(), { timeout: 2000 });
    expect(document.querySelector('.tp-chat-avatar')).toBeNull();
    expect(document.querySelector('[data-testid^="chat-avatar"]')).toBeNull();
  });

  // Value: protects=AI 與自己的訊息上方各有一行名稱標籤，位於氣泡之前; fails_when=標籤被移除或排在氣泡之後; why_new=原本只有協作者有名字、AI 與自己的名字擠在時間前面; seam=none; no_claim=不含顏色
  it('AI 標籤「Tripline AI」、自己標籤為帳號名，都在氣泡上方', async () => {
    renderPage();
    await waitFor(() => expect(screen.queryByTestId('chat-msg-user')).toBeTruthy(), { timeout: 2000 });
    for (const [bubbleId, cls, text] of [['chat-msg-assistant', 'is-assistant', 'Tripline AI'], ['chat-msg-user', 'is-user', 'Ray']] as const) {
      const bubble = screen.getByTestId(bubbleId);
      const label = bubble.parentElement!.querySelector(`.tp-chat-msg-sender-name.${cls}`);
      expect(label?.textContent).toBe(text);
      expect(label!.compareDocumentPosition(bubble) & Node.DOCUMENT_POSITION_FOLLOWING, '標籤要在氣泡之前').toBeTruthy();
    }
  });

  // Value: protects=帳號名稱只有空白時，自己的標籤落回 email 前綴而不是顯示空白; fails_when=selfDisplayName 不再 trim 後才判斷 fallback; why_new=Red Team 審查指出純空白名稱會讓標籤空白; seam=none; no_claim=不含長名稱換行（CSS）
  it('帳號名稱為純空白：自己的標籤落回 email 前綴', async () => {
    U.displayName = '   ';
    renderPage();
    await waitFor(() => expect(screen.queryByTestId('chat-msg-user')).toBeTruthy(), { timeout: 2000 });
    const label = screen.getByTestId('chat-msg-user').parentElement!.querySelector('.tp-chat-msg-sender-name.is-user');
    expect(label?.textContent).toBe('u');
  });

  // Value: protects=真人不能用「Tripline AI」當名字冒充 AI（頭像移除後身分只剩標籤文字）; fails_when=humanSenderLabel 不再處理撞名; why_new=對抗審查指出移除 AI 頭像後的冒充風險; seam=none; no_claim=不含伺服端是否禁止此名稱
  it('真人名稱撞到「Tripline AI」：標籤加註（成員），AI 自己不受影響', async () => {
    U.displayName = 'tripline ai';
    renderPage();
    await waitFor(() => expect(screen.queryByTestId('chat-msg-user')).toBeTruthy(), { timeout: 2000 });
    const own = screen.getByTestId('chat-msg-user').parentElement!.querySelector('.tp-chat-msg-sender-name.is-user');
    expect(own?.textContent).toBe('tripline ai（成員）');
    const ai = screen.getByTestId('chat-msg-assistant').parentElement!.querySelector('.tp-chat-msg-sender-name.is-assistant');
    expect(ai?.textContent).toBe('Tripline AI');
  });

  // Value: protects=冒充 AI 的名稱變體（零寬字元、多餘空白、全形、bidi 覆寫）都會被加註或淨化; fails_when=humanSenderLabel 只做 trim+lowercase，或不去掉格式字元; why_new=對抗審查指出單純比對字串可被繞過; seam=none; no_claim=不擋跨字母系統形近字（西里爾）
  it.each([
    ['零寬字元', 'Tri\u200Bpline AI'],
    ['雙空白與不換行空白', 'Tripline\u00A0 AI'],
    ['全形', 'Ｔｒｉｐｌｉｎｅ ＡＩ'],
    ['大小寫', 'TRIPLINE ai'],
    ['小寫 L 冒充大寫 I', 'Tripline Al'],
    ['點不見的變體選擇符', 'Tripline AI\uFE0F'],
    ['dotless i', 'Trıpline AI'],
  ])('冒充 AI 的名稱（%s）會被加註（成員）', (_n, name) => {
    expect(humanSenderLabel(name)).toMatch(/（成員）$/);
  });

  it('bidi 覆寫字元被去掉，不會反轉顯示；純零寬名稱視為空', () => {
    expect(sanitizeSenderName('\u202EIA enilpirT')).toBe('IA enilpirT');
    expect(sanitizeSenderName('\u200B\u200D ')).toBe('');
    expect(humanSenderLabel('Ray')).toBe('Ray');
    expect(sanitizeSenderName('\u3164\u2800')).toBe('');
  });

  // Value: protects=合法名字不被淨化弄壞（emoji ZWJ 組合、波斯文 ZWNJ 要保留）; fails_when=顯示端又把所有 Cf 字元拿掉; why_new=最終審查指出先前的全 Cf 去除會誤傷; seam=none; no_claim=不含字型渲染
  it('合法名字保留 ZWJ／ZWNJ，不被加註', () => {
    const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
    const persian = 'می\u200Cخواهم';
    expect(humanSenderLabel(family)).toBe(family);
    expect(humanSenderLabel(persian)).toBe(persian);
  });

  // Value: protects=協作者訊息的標籤用對方名字（優先 displayName、其次 email 前綴）、套協作者樣式; fails_when=協作者標籤消失或用到自己的名字; why_new=協作者路徑原本沒有直接測試; seam=none; no_claim=不含顏色
  it('協作者的訊息：標籤為對方名字，氣泡用 other-user 樣式', async () => {
    apiFetchMock.mockImplementation((path: string) => {
      if (path.startsWith('/requests')) {
        return Promise.resolve({
          items: [{ ...SAMPLE_REQUEST_ROW, submittedBy: 'friend@x.com', submittedByDisplayName: 'Penyin' }],
          hasMore: false,
        });
      }
      if (path === '/my-trips') return Promise.resolve([{ tripId: 'okinawa-2026', name: '沖繩 2026', title: '沖繩 2026', countries: 'JP' }]);
      return Promise.resolve(null);
    });
    renderPage();
    await waitFor(() => expect(screen.queryByTestId('chat-msg-other-user')).toBeTruthy(), { timeout: 2000 });
    const bubble = screen.getByTestId('chat-msg-other-user');
    expect(bubble.className).toContain('tp-chat-msg-other-user');
    expect(bubble.parentElement!.querySelector('.tp-chat-msg-sender-name.is-other-user')?.textContent).toBe('Penyin');
  });

  // Value: protects=時間行只剩時間，名稱已搬到氣泡上方不再重複; fails_when=時間前又出現「名稱 · 」; why_new=取代原本要求「Tripline AI · 」前綴的相反斷言; seam=none; no_claim=不含時間格式本身
  it('時間行只有時間，不含「名稱 · 」前綴', async () => {
    renderPage();
    await waitFor(() => {
      const ts = document.querySelector('.tp-chat-msg-time-assistant');
      expect(ts).toBeTruthy();
      expect(ts?.textContent).not.toMatch(/Tripline AI|·/);
      const mine = document.querySelector('.tp-chat-msg-time-user');
      expect(mine?.textContent).not.toMatch(/Ray|·/);
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
    // 2026-07-21：原本等 `chat-trip-picker`（TitleBar 右側那顆 ⇄ 圖示按鈕）。
    // 形制改成「標題即切換器」後那個 testid 不存在了；而本 fixture 只有一個
    // 行程，TripTitleSwitcher 會刻意渲染純文字（沒得換就不給可點的假象），
    // 連 `chat-trip-title` 也不會出現。
    // 這條要驗的本意沒變 —— 標題顯示的是行程名而非寫死的「聊天」，直接等它。
    await waitFor(() => {
      const heading = document.querySelector('h1, [data-testid="page-header-title"]');
      expect(heading?.textContent).toContain('沖繩 2026');
    }, { timeout: 2000 });
    const heading = document.querySelector('h1, [data-testid="page-header-title"]');
    expect(heading!.textContent).not.toContain('聊天');
  });
});
