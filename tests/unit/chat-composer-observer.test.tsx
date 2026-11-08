/**
 * ChatPage 的 dock（提示條＋composer）量測：dock 浮在訊息上面，訊息區留白靠 ResizeObserver 量到的高度（--chat-composer-h）。
 * jsdom 沒有版面，所以這裡只鎖「量測的生命週期與捲動釘住的判斷」：掛上、尺寸變了會更新、
 * 本來在底部就重新釘回底部（不在底部則不動）、卸載會斷開、環境沒有 ResizeObserver 也不爆。
 * 版面本身（留白是否真的夠、是否貼著 tab）由 tests/e2e/chat-composer-glass.spec.js 在真瀏覽器驗。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
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

function installApi() {
  apiFetchMock.mockImplementation((path: string) => {
    if (path === '/account/ai-authorization') return Promise.resolve({ authorized: true });
    if (path === '/account/ai-data-consent') return Promise.resolve({ status: 'none', currentVersion: 'v', acceptedVersion: null, acceptedAt: null, text: null, enforced: false });
    if (path.startsWith('/requests')) return Promise.resolve({ items: [], hasMore: false });
    if (path === '/my-trips') return Promise.resolve([{ tripId: 'okinawa-2026' }]);
    if (path.startsWith('/trips/okinawa-2026/ai-authorization')) return Promise.resolve({ ownerAuthorized: true, isOwner: true });
    if (path.startsWith('/trips')) return Promise.resolve([{ tripId: 'okinawa-2026', name: '沖繩 2026', title: '沖繩 2026', countries: 'JP' }]);
    return Promise.resolve(null);
  });
}
const mount = () => render(<MemoryRouter initialEntries={['/chat?tripId=okinawa-2026']}><ChatPage /></MemoryRouter>);

class StubRO {
  static instances: StubRO[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(public cb: () => void) { StubRO.instances.push(this); }
  observe(el: Element) { this.observed.push(el); }
  disconnect() { this.disconnected = true; }
  unobserve() {}
}

let height = 0;
let originalOffsetHeight: PropertyDescriptor | undefined;
beforeEach(() => {
  apiFetchMock.mockReset();
  installApi();
  StubRO.instances = [];
  height = 64;
  originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalOffsetHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
  else delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetHeight;
});

const dockOf = (input: HTMLElement) => input.closest('form')!.parentElement as HTMLElement;

describe('ChatPage composer 高度量測', () => {
  // Value: protects=composer 高度被量到並寫進 shell 的 --chat-composer-h，尺寸改變時更新; fails_when=ref 不再掛 observer 或 apply 不寫變數; why_new=沒有其他測試碰這個 ref 的生命週期; seam=none; no_claim=不含真實版面
  it('掛上 observer、寫入高度，尺寸變了會更新', async () => {
    vi.stubGlobal('ResizeObserver', StubRO);
    mount();
    const dock = dockOf(await screen.findByTestId('chat-input'));
    const shell = screen.getByTestId('chat-page');
    await waitFor(() => expect(shell.style.getPropertyValue('--chat-composer-h')).toBe('64px'));
    const ro = StubRO.instances.find((i) => i.observed.includes(dock));
    expect(ro, 'observer 要觀察 dock（提示條＋composer）').toBeTruthy();
    height = 120;
    ro!.cb();
    expect(shell.style.getPropertyValue('--chat-composer-h')).toBe('120px');
  });

  // Value: protects=dock 被隱藏（高度 0）時不把留白歸零，切回來時最新訊息不被蓋住; fails_when=apply 不再略過高度 0; why_new=對抗審查指出嵌入分頁切走時的風險; seam=none; no_claim=不含真實分頁切換
  it('dock 隱藏（高度 0）時保留上一次的 --chat-composer-h', async () => {
    vi.stubGlobal('ResizeObserver', StubRO);
    mount();
    const dock = dockOf(await screen.findByTestId('chat-input'));
    const shell = screen.getByTestId('chat-page');
    await waitFor(() => expect(shell.style.getPropertyValue('--chat-composer-h')).toBe('64px'));
    height = 0;
    StubRO.instances.find((r) => r.observed.includes(dock))!.cb();
    expect(shell.style.getPropertyValue('--chat-composer-h')).toBe('64px');
  });

  // Value: protects=使用者本來就在底部時，dock 長高後捲動位置重新釘回底部，最新一則不被蓋住；不在底部（在讀舊訊息）則不動; fails_when=移除 wasAtBottom 判斷或 re-pin（最新訊息被 dock 蓋住）; why_new=QA 與 Performance 審查實測到的缺陷，原本沒有任何測試; seam=none; no_claim=不含真實版面（e2e 驗）
  it.each([
    ['已在底部', 500, 1000],
    ['離底部 10px 內（容差）', 490, 1000],
    ['超出容差（離底部 120px）', 380, 380],
    ['沒在底部（在讀舊訊息）', 100, 100],
  ])('dock 長高時：%s', async (_n, startTop, expectedTop) => {
    vi.stubGlobal('ResizeObserver', StubRO);
    mount();
    const dock = dockOf(await screen.findByTestId('chat-input'));
    const body = screen.getByTestId('chat-body');
    let scrollTop = startTop;
    Object.defineProperty(body, 'scrollHeight', { configurable: true, get: () => 1000 });
    Object.defineProperty(body, 'clientHeight', { configurable: true, get: () => 500 });
    Object.defineProperty(body, 'scrollTop', { configurable: true, get: () => scrollTop, set: (v: number) => { scrollTop = v; } });
    const ro = StubRO.instances.find((i) => i.observed.includes(dock))!;
    height = 160;
    ro.cb();
    expect(scrollTop).toBe(expectedTop);
  });

  // Value: protects=卸載時 observer 被斷開、不外洩; fails_when=ref 回收時不再 disconnect; why_new=同上; seam=none; no_claim=不含重新掛載後的量測
  it('卸載時斷開 observer', async () => {
    vi.stubGlobal('ResizeObserver', StubRO);
    const view = mount();
    const dock = dockOf(await screen.findByTestId('chat-input'));
    const ro = StubRO.instances.find((i) => i.observed.includes(dock))!;
    expect(ro.disconnected).toBe(false);
    view.unmount();
    expect(ro.disconnected).toBe(true);
  });

  // Value: protects=沒有 ResizeObserver 的環境（舊瀏覽器、jsdom）仍能 render，留白走 CSS 的預設值; fails_when=移除 typeof 守衛; why_new=同上; seam=none; no_claim=不含預設留白是否足夠
  it('環境沒有 ResizeObserver 時照常 render、不寫變數', async () => {
    vi.stubGlobal('ResizeObserver', undefined);
    mount();
    const input = await screen.findByTestId('chat-input');
    expect(input).toBeTruthy();
    expect(screen.getByTestId('chat-page').style.getPropertyValue('--chat-composer-h')).toBe('');
  });
});
