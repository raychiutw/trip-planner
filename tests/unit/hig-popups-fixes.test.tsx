/**
 * Value: protects=#1587 彈出層取證修正（報告編號 12、13、15、16、18、19、20、21、22、24）；
 *   fails_when=橫幅文字色用不存在的 token 或對比 < 4.5、橫幅不讓出 app-shell 高度、Toast 位置不照 DESIGN.md、
 *   Toast role 與 aria-live 互相矛盾、探索頁搜尋太短只有 Toast、分享對話框兩個「關閉」同名、有效期限折成孤列、
 *   彈出層觸控目標 < 44、筆記區塊標題列 button 巢狀 button、彈出層標題層級不一致、登出失敗沒有重試與去向說明；
 *   why_new=axe／版面只在 e2e 手動收集，沒有單元層守門；seam=none；no_claim=真實版面幾何（見 tests/e2e/hig-fixes.spec.js）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axe from 'axe-core';
import { contrastRatio, cssRule, stripCssComments } from './__helpers__/wcag';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const TOKENS = stripCssComments(read('css/tokens.css'));

// ── 共用 mock ─────────────────────────────────────────────────────────────
const onlineMock = vi.hoisted(() => ({ value: false }));
vi.mock('../../src/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => onlineMock.value, registerNetworkCallbacks: vi.fn(), reportFetchResult: vi.fn() }));

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
  apiFetchRaw: vi.fn(),
}));
vi.mock('../../src/hooks/useRequireAuth', () => ({ useRequireAuth: () => ({ ready: true, user: { id: 'u1', email: 'u@x.com' } }) }));
vi.mock('../../src/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'u1', email: 'u@x.com' }, email: 'u@x.com' }) }));
vi.mock('../../src/components/shell/AppShell', () => ({
  default: ({ main, bottomNav }: { main: React.ReactNode; bottomNav?: React.ReactNode }) => <div>{main}{bottomNav}</div>,
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

vi.mock('../../src/lib/shareApi', () => ({
  listShares: vi.fn().mockResolvedValue([
    { id: 7, label: '給爸媽', visibleSections: '["flights"]', expiresAt: null, anonymous: 0, viewCount: 3, createdAt: '2026-11-01 00:00:00', revokedAt: null },
  ]),
  createShare: vi.fn(), revokeShare: vi.fn(), rotateShare: vi.fn(), updateShare: vi.fn(), deleteShare: vi.fn(),
}));

import { ServerStatusBanner } from '../../src/components/ServerStatusBanner';
import ToastContainer, { showToast, resetToasts } from '../../src/components/shared/Toast';
import ShareLinkModal from '../../src/components/share/ShareLinkModal';
import TripNotesPage from '../../src/pages/TripNotesPage';
import ExplorePage from '../../src/pages/ExplorePage';
import SessionsPage from '../../src/pages/SessionsPage';
import ErrorBanner from '../../src/components/shared/ErrorBanner';
import { TripContext } from '../../src/contexts/TripContext';

void TripContext;

afterEach(cleanup);

// ── 12：橫幅深色對比 ────────────────────────────────────────────────────────
describe('#12 ServerStatusBanner 顏色', () => {
  /** 取 --color-destructive／-bg 在淺色（第一次出現）與深色（第二次出現，body.dark 區塊）的值 */
  const tokenValues = (name: string) => [...TOKENS.matchAll(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})\\b`, 'g'))].map((m) => m[1]);

  it('文字與底色只用 css/ 裡真的存在的 token', () => {
    onlineMock.value = false;
    render(<ServerStatusBanner />);
    const style = screen.getByTestId('server-status-banner').getAttribute('style') ?? '';
    const names = [...style.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) {
      expect(TOKENS, `token ${n} 不存在於 css/tokens.css（會永遠落到寫死的 fallback）`).toMatch(new RegExp(`${n}\\s*:`));
    }
  });

  it('淺色與深色下，文字對底色 ≥ 4.5:1（底色用不透明 token，對比才可預測）', () => {
    onlineMock.value = false;
    render(<ServerStatusBanner />);
    const style = screen.getByTestId('server-status-banner').getAttribute('style') ?? '';
    const color = /(?:^|;)\s*color:\s*var\(--color-([a-z-]+)/.exec(style)?.[1];
    const bg = /background:\s*var\(--color-([a-z-]+)/.exec(style)?.[1];
    expect(color, '找不到 color token').toBeTruthy();
    expect(bg, '找不到 background token').toBeTruthy();
    const fg = tokenValues(`color-${color}`);
    const bgs = tokenValues(`color-${bg}`);
    // [0]=淺色 :root、[1]=深色（prefers-color-scheme／body.dark 區塊）
    expect(fg.length).toBeGreaterThanOrEqual(2);
    expect(bgs.length).toBeGreaterThanOrEqual(2);
    expect(contrastRatio(fg[0], bgs[0]), `淺色 ${fg[0]} on ${bgs[0]}`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(fg[1], bgs[1]), `深色 ${fg[1]} on ${bgs[1]}`).toBeGreaterThanOrEqual(4.5);
  });
});

// ── 13：橫幅納入 app-shell 高度 ─────────────────────────────────────────────
describe('#13 橫幅不在 100dvh 之外多佔高度', () => {
  it('離線時把橫幅高度發布成 --server-banner-h；上線後移除', () => {
    onlineMock.value = false;
    const { rerender, unmount } = render(<ServerStatusBanner />);
    expect(document.documentElement.style.getPropertyValue('--server-banner-h')).not.toBe('');
    onlineMock.value = true;
    rerender(<ServerStatusBanner />);
    expect(document.documentElement.style.getPropertyValue('--server-banner-h')).toBe('');
    onlineMock.value = false;
    rerender(<ServerStatusBanner />);
    unmount();
    expect(document.documentElement.style.getPropertyValue('--server-banner-h')).toBe('');
  });

  it('.app-shell 的高度扣掉橫幅高度（總高仍是 100dvh，整頁不出現捲軸）', () => {
    expect(cssRule(stripCssComments(read('src/components/shell/AppShell.tsx')), '.app-shell')).toMatch(/height:\s*calc\(100dvh - var\(--server-banner-h,\s*0px\)\)/);
  });
});

// ── 15、16：Toast ───────────────────────────────────────────────────────────
describe('#15 Toast 位置（DESIGN.md Error & Status Messaging）', () => {
  it('Toast 容器用 .tp-toast-region，不再釘在視窗頂端', () => {
    const src = read('src/components/shared/Toast.tsx');
    expect(src).toContain('tp-toast-region');
    expect(src).not.toMatch(/top-toast-top/);
  });

  it('compact：底部且高於 bottom nav', () => {
    const rule = cssRule(TOKENS, '.tp-toast-region');
    expect(rule).toMatch(/bottom:\s*calc\([^;]*--nav-height-mobile/);
    expect(rule).not.toMatch(/(?:^|[;\s])top:/);
  });

  it('桌機（≥1024px）：右上、titlebar 下方', () => {
    const media = /@media \(min-width: 1024px\)\s*\{\s*\.tp-toast-region\s*\{([^}]*)\}/.exec(TOKENS)?.[1] ?? '';
    expect(media, '找不到 ≥1024px 的 .tp-toast-region 規則').not.toBe('');
    expect(media).toMatch(/top:\s*calc\([^;]*--titlebar-h/);
    expect(media).toMatch(/right:\s*16px/);
    expect(media).toMatch(/bottom:\s*auto/);
  });
});

describe('#16 Toast 語意：role 與 aria-live 不互相矛盾', () => {
  beforeEach(() => resetToasts());

  it('error 用 role=alert（隱含 assertive），不再另設矛盾的 aria-live=polite', () => {
    render(<ToastContainer />);
    act(() => { showToast('壞了', 'error'); });
    const el = screen.getByRole('alert');
    expect(el.hasAttribute('aria-live')).toBe(false);
  });

  it('非錯誤（info／success／offline／online）用 role=status（隱含 polite），不是 alert', () => {
    render(<ToastContainer />);
    act(() => { showToast('提示', 'info'); showToast('好了', 'success'); showToast('離線', 'offline'); showToast('恢復', 'online'); });
    expect(screen.queryByRole('alert')).toBeNull();
    const all = screen.getAllByRole('status');
    expect(all).toHaveLength(4);
    for (const el of all) expect(el.hasAttribute('aria-live')).toBe(false);
  });
});

describe('#16 探索頁搜尋少於 2 字：欄位自己的錯誤文字', () => {
  const toastSpy = vi.fn();
  beforeEach(() => {
    sessionStorage.clear();
    toastSpy.mockClear();
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((path: string) => (path === '/poi-favorites' ? Promise.resolve([]) : Promise.resolve({ results: [] })));
    class Observer { observe() {} disconnect() {} }
    vi.stubGlobal('IntersectionObserver', Observer);
  });

  async function openExplore() {
    render(<MemoryRouter><ExplorePage /></MemoryRouter>);
    await waitFor(() => expect((screen.getByTestId('explore-search-submit') as HTMLButtonElement).disabled).toBe(false));
  }

  it('送出 1 個字：欄位下方出現錯誤文字、aria-invalid、aria-describedby 指到它；繼續輸入就清除', async () => {
    await openExplore();
    const input = screen.getByTestId('explore-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.click(screen.getByTestId('explore-search-submit'));
    const err = await screen.findByTestId('explore-search-error');
    expect(err.textContent).toContain('至少輸入 2 個字');
    expect(err.id).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(err.id);
    // 不再依賴 2 秒 Toast：文字不會自己消失，直到使用者修正
    fireEvent.change(input, { target: { value: 'ab' } });
    expect(screen.queryByTestId('explore-search-error')).toBeNull();
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });

  it('不再為此情境發 Toast', () => {
    expect(read('src/pages/ExplorePage.tsx')).not.toMatch(/showToast\('至少輸入 2 個字'/);
  });
});

// ── 18、19、20：分享對話框 ─────────────────────────────────────────────────
describe('分享對話框', () => {
  const SHARE = read('src/components/share/ShareLinkModal.tsx');
  const STYLE = stripCssComments(/const STYLE = `([\s\S]*?)`;/.exec(SHARE)![1]);

  it('#18 兩個關閉動作的可存取名稱可區分，且連結卡按鈕的名稱含可見文字（WCAG 2.5.3）', async () => {
    render(<ShareLinkModal tripId="t1" open onClose={() => {}} />);
    const revoke = await screen.findByTestId('share-revoke-7');
    const x = screen.getByRole('button', { name: '關閉對話框' });
    expect(x).toBeTruthy();
    const visible = (revoke.textContent ?? '').trim();
    const name = revoke.getAttribute('aria-label') ?? visible;
    expect(name.startsWith(visible), `名稱「${name}」應以可見文字「${visible}」開頭`).toBe(true);
    expect(name).not.toBe('關閉');
    expect(screen.queryByRole('button', { name: '關閉' })).toBeNull();
    expect(name).not.toBe(x.getAttribute('aria-label'));
  });

  it('#19 有效期限分段控制不折行（不會留下只有「自訂」的孤列）：單列並可橫向捲動', () => {
    const rule = cssRule(STYLE, '.tp-sharemodal-seg');
    expect(rule).toMatch(/flex-wrap:\s*nowrap/);
    expect(rule).toMatch(/overflow-x:\s*auto/);
    expect(rule).toMatch(/max-width:\s*100%/);
    expect(rule).not.toMatch(/width:\s*fit-content/);
  });

  it.each([
    '.tp-sharemodal-x', '.tp-sharemodal-input', '.tp-sharemodal-pill', '.tp-sharemodal-seg button',
    '.tp-sharemodal-create', '.tp-sharemodal-act', '.tp-sharemodal-anon',
  ])('#20 %s 的觸控高度 ≥ 44（--spacing-tap-min）', (sel) => {
    expect(cssRule(STYLE, sel)).toMatch(/min-height:\s*var\(--spacing-tap-min\)/);
  });

  it('#20 ✕ 是 44×44', () => {
    expect(cssRule(STYLE, '.tp-sharemodal-x')).toMatch(/min-width:\s*var\(--spacing-tap-min\)/);
  });
});

describe('#20 帳號 sheet「編輯名稱」與聊天建議 chip／送出鈕', () => {
  it('編輯名稱鈕 44×44（量測的是元素本身，不是偽元素點擊區）', () => {
    const rule = cssRule(stripCssComments(read('src/pages/AccountPage.tsx')), '.tp-account-hero-name-edit');
    expect(rule).toMatch(/width:\s*var\(--spacing-tap-min\)/);
    expect(rule).toMatch(/height:\s*var\(--spacing-tap-min\)/);
  });

  it('聊天建議 chip 高度 ≥ 44、送出鈕 44×44', () => {
    const css = stripCssComments(read('src/pages/ChatPage.tsx'));
    expect(cssRule(css, '.tp-chat-suggestion')).toMatch(/min-height:\s*var\(--spacing-tap-min\)/);
    const send = cssRule(css, '.tp-chat-send');
    expect(send).toMatch(/width:\s*var\(--spacing-tap-min\)/);
    expect(send).toMatch(/height:\s*var\(--spacing-tap-min\)/);
  });
});

// ── 21：筆記區塊標題列 ─────────────────────────────────────────────────────
describe('#21 筆記區塊標題列不巢狀互動元素', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({ flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [] });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((q: string) => ({
        matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
        addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
      })),
    });
  });

  function renderNotes() {
    return render(
      <MemoryRouter initialEntries={['/trip/trip-1/notes']}>
        <Routes><Route path="/trip/:tripId/notes" element={<TripNotesPage />} /></Routes>
      </MemoryRouter>,
    );
  }

  it('展開含 AI 鈕的區塊後，axe nested-interactive 無違規；標題是真的 <button>，AI 鈕是它的兄弟', async () => {
    const { container } = renderNotes();
    const head = await screen.findByTestId('trip-notes-section-head-pretrip');
    fireEvent.click(head);
    expect(screen.getByTestId('trip-notes-ai-btn-pretrip')).toBeTruthy();
    expect(head.tagName).toBe('BUTTON');
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(head.contains(screen.getByTestId('trip-notes-ai-btn-pretrip'))).toBe(false);
    expect(container.querySelectorAll('[role="button"] button, button button')).toHaveLength(0);
    const res = await axe.run(container, { runOnly: ['nested-interactive'] });
    expect(res.violations.map((v) => v.id)).toEqual([]);
  });

  it('鍵盤：標題按鈕是原生 button（Enter／Space 由瀏覽器處理），點擊仍切換展開', async () => {
    renderNotes();
    const head = await screen.findByTestId('trip-notes-section-head-lodgings');
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(head.getAttribute('type')).toBe('button');
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
  });
});

// ── 22：彈出層標題層級 ─────────────────────────────────────────────────────
describe('#22 彈出層標題一律 h2（DESIGN.md：Modal 標題 <h2>；頁面只有一個 h1）', () => {
  const POPUPS: Record<string, RegExp> = {
    'src/components/AiConsentSheet.tsx': /<(h\d)[^>]*id="tp-consent-title"/,
    'src/components/AiDataConsentSheet.tsx': /<(h\d)[^>]*id="tp-dc-title"/,
    'src/components/shared/ConfirmModal.tsx': /<(h\d)[^>]*id="tp-confirm-title"/,
    'src/components/shared/ConflictModal.tsx': /<(h\d)[^>]*id="tp-conflict-title"/,
    'src/components/shared/InputModal.tsx': /<(h\d)[^>]*id="tp-input-title"/,
    'src/components/trip-notes/NoteAiExclusionsDialog.tsx': /<(h\d)[^>]*id="tp-note-ai-exclusions-title"/,
    'src/components/trip/TravelPillDialog.tsx': /<(h\d)[^>]*id=\{titleId\}/,
    'src/components/share/ShareLinkModal.tsx': /<(h\d)[^>]*id="tp-sharemodal-title"/,
  };
  it.each(Object.entries(POPUPS))('%s', (file, re) => {
    const m = re.exec(read(file));
    expect(m, `${file} 找不到標題元素`).not.toBeNull();
    expect(m![1]).toBe('h2');
  });
});

// ── 24：登出失敗 ───────────────────────────────────────────────────────────
describe('#24 ErrorBanner 重試動作', () => {
  it('有 action 時顯示按鈕（≥44）並可點；沒有 action 時不顯示', () => {
    const onClick = vi.fn();
    const { rerender } = render(<ErrorBanner message="壞了" action={{ label: '重試', onClick }} testId="eb" />);
    fireEvent.click(screen.getByRole('button', { name: '重試' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<ErrorBanner message="壞了" testId="eb" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('#24 SessionsPage 登出此裝置失敗', () => {
  const SESSIONS = [
    { sid: 'cur', ua_summary: 'Chrome', ip_hash_prefix: null, created_at: '2026-11-01T00:00:00Z', last_seen_at: '2026-11-01T00:00:00Z', is_current: true },
    { sid: 'phone', ua_summary: 'Safari', ip_hash_prefix: null, created_at: '2026-11-01T00:00:00Z', last_seen_at: '2026-11-01T00:00:00Z', is_current: false },
  ];

  it('失敗訊息說明該裝置仍在登入、提供重試；重試成功後訊息消失、該列移除', async () => {
    const fetchMock = vi.fn();
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/account/sessions' && !init?.method) return Promise.resolve({ sessions: SESSIONS });
      return fetchMock(path, init);
    });
    fetchMock.mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce({ ok: true });
    render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    fireEvent.click(await screen.findByTestId('sessions-revoke-phone'));
    const banner = await screen.findByTestId('sessions-error');
    expect(banner.textContent).toContain('登出此裝置失敗');
    expect(banner.textContent).toMatch(/仍(?:在|保持)登入/);
    fireEvent.click(screen.getByRole('button', { name: '重試' }));
    await waitFor(() => expect(screen.queryByTestId('sessions-row-phone')).toBeNull());
    expect(screen.queryByTestId('sessions-error')).toBeNull();
  });

  it('橫幅上緣與清單卡的間距與下緣一致（16px）', () => {
    const css = read('src/pages/SessionsPage.tsx');
    expect(css).toMatch(/\.tp-sessions-error\s*\{[^}]*margin-top:\s*16px/);
    expect(read('src/pages/SessionsPage.tsx')).toMatch(/className="tp-sessions-error"/);
  });
});

// ── 14：全域橫幅是唯一的離線提示 ───────────────────────────────────────────
describe('#14 橫幅在場時不再跳「離線」Toast（只抑制離線這一類）', () => {
  beforeEach(() => resetToasts());

  it('橫幅在場：離線 Toast 不出現；其他種類照常；橫幅消失後離線 Toast 恢復', () => {
    onlineMock.value = false;
    const banner = render(<ServerStatusBanner />);
    render(<ToastContainer />);
    act(() => { showToast('已離線 — 顯示快取資料', 'offline'); });
    expect(screen.queryByText('已離線 — 顯示快取資料')).toBeNull();
    act(() => { showToast('已複製', 'info'); showToast('壞了', 'error'); showToast('已恢復連線', 'online'); });
    expect(screen.getByText('已複製')).toBeTruthy();
    expect(screen.getByText('壞了')).toBeTruthy();
    expect(screen.getByText('已恢復連線')).toBeTruthy();
    onlineMock.value = true;
    banner.rerender(<ServerStatusBanner />);
    act(() => { showToast('已離線 — 顯示快取資料', 'offline'); });
    expect(screen.getByText('已離線 — 顯示快取資料')).toBeTruthy();
  });

  it('離線 Toast 先出現、橫幅後到：橫幅出現時把既有的離線 Toast 收掉', () => {
    onlineMock.value = true;
    const banner = render(<ServerStatusBanner />);
    render(<ToastContainer />);
    act(() => { showToast('已離線 — 顯示快取資料', 'offline'); showToast('已複製', 'info'); });
    expect(screen.getByText('已離線 — 顯示快取資料')).toBeTruthy();
    onlineMock.value = false;
    banner.rerender(<ServerStatusBanner />);
    expect(screen.queryByText('已離線 — 顯示快取資料')).toBeNull();
    expect(screen.getByText('已複製')).toBeTruthy();
  });
});

describe('#17 ConflictModal 預設文案不變（其他呼叫端不受影響），可由呼叫端覆寫', () => {
  it('不傳 message／cancelLabel：維持「要怎麼處理？」與「取消」，選項照常顯示', async () => {
    const { default: ConflictModal } = await import('../../src/components/shared/ConflictModal');
    render(<ConflictModal open conflictWith={{ entryId: 1, time: '12:00', title: 'A', dayNum: 1 }} onCancel={() => {}} onReplace={() => {}} onPushAfter={() => {}} />);
    expect(screen.getByTestId('conflict-modal').textContent).toContain('要怎麼處理？');
    expect(screen.getByTestId('conflict-modal-cancel').textContent).toBe('取消');
    expect(screen.getByTestId('conflict-modal-replace')).toBeTruthy();
    expect(screen.getByTestId('conflict-modal-after')).toBeTruthy();
  });
});
