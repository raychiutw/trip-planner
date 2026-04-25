/**
 * DesktopSidebar —
 *
 * Visible nav items (3 anonymous, 4 logged-in): 行程 / 探索 / 登入 (anon) +
 * 已連結應用 / 開發者 / 登出 chip (logged-in). 聊天 + 地圖 are flagged
 * `comingSoon` and hidden from sidebar until Phase 3 builds the real product
 * (per `mockup-chat-v2.html` + `mockup-map-v2.html`).
 *
 * 視覺對應：docs/design-sessions/mockup-trip-v2.html sidebar 區塊。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DesktopSidebar from '../../src/components/shell/DesktopSidebar';

function renderSidebar(opts: {
  path?: string;
  user?: { name: string; email: string } | null;
  onNewTrip?: () => void;
} = {}) {
  return render(
    <MemoryRouter initialEntries={[opts.path ?? '/manage']}>
      <DesktopSidebar
        user={opts.user ?? null}
        onNewTrip={opts.onNewTrip ?? vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('DesktopSidebar — visible nav items (anonymous)', () => {
  it('渲染 3 個 nav items: 行程 / 探索 / 登入（聊天 + 地圖 是 Phase 3 placeholder, 隱藏）', () => {
    const { getAllByRole } = renderSidebar();
    const links = getAllByRole('link');
    expect(links.length).toBe(3);
    expect(links[0].textContent).toContain('行程');
    expect(links[1].textContent).toContain('探索');
    expect(links[2].textContent).toContain('登入');
    // 確認 placeholder 沒進 nav
    const allText = links.map((l) => l.textContent).join('|');
    expect(allText).not.toContain('聊天');
    expect(allText).not.toContain('地圖');
  });

  it('nav items href 對應 /manage /explore /login', () => {
    const { getAllByRole } = renderSidebar();
    const links = getAllByRole('link') as HTMLAnchorElement[];
    expect(links[0].getAttribute('href')).toBe('/manage');
    expect(links[1].getAttribute('href')).toBe('/explore');
    expect(links[2].getAttribute('href')).toBe('/login');
  });
});

describe('DesktopSidebar — active state', () => {
  it('路由 /manage 時「行程」item 有 is-active class', () => {
    const { getAllByRole } = renderSidebar({ path: '/manage' });
    const links = getAllByRole('link');
    expect(links[0].className).toMatch(/is-active/);
    // 其他 nav 不 active
    expect(links[1].className).not.toMatch(/is-active/);
    expect(links[2].className).not.toMatch(/is-active/);
  });

  it('路由 /trip/abc 時「行程」item 仍 active（trip 屬於行程 scope）', () => {
    const { getAllByRole } = renderSidebar({ path: '/trip/abc' });
    const links = getAllByRole('link');
    expect(links[0].className).toMatch(/is-active/);
  });

  it('路由 /trip/abc/map 時「行程」item active（per-trip sub-route，不轉到全域 /map）', () => {
    const { getAllByRole } = renderSidebar({ path: '/trip/abc/map' });
    const links = getAllByRole('link');
    expect(links[0].className).toMatch(/is-active/);
  });

  it('路由 /explore 時「探索」item active', () => {
    const { getAllByRole } = renderSidebar({ path: '/explore' });
    const links = getAllByRole('link');
    expect(links[1].className).toMatch(/is-active/);
  });

  it('路由 /login 或 sub-route 時「登入」item active', () => {
    const { getAllByRole } = renderSidebar({ path: '/login/forgot' });
    const links = getAllByRole('link');
    expect(links[2].className).toMatch(/is-active/);
  });
});

describe('DesktopSidebar — user chip', () => {
  it('未登入：user chip 顯示「未登入」', () => {
    const { container } = renderSidebar({ user: null });
    const chip = container.querySelector('[data-testid="sidebar-user-chip"]');
    expect(chip?.textContent).toContain('未登入');
  });

  it('已登入：顯示帳號 chip 含 name + email', () => {
    const { container } = renderSidebar({
      user: { name: 'Ray Chiu', email: 'ray@trip.io' },
    });
    const chip = container.querySelector('[data-testid="sidebar-account-card"]');
    expect(chip).toBeTruthy();
    expect(chip?.textContent).toContain('Ray Chiu');
    expect(chip?.textContent).toContain('ray@trip.io');
  });

  it('已登入時不顯示「未登入」chip', () => {
    const { container } = renderSidebar({
      user: { name: 'Ray', email: 'ray@trip.io' },
    });
    expect(container.querySelector('[data-testid="sidebar-user-chip"]')).toBeNull();
  });

  it('已登入：顯示「登出」link href=/api/oauth/logout', () => {
    const { container } = renderSidebar({
      user: { name: 'Ray', email: 'ray@trip.io' },
    });
    const logout = container.querySelector('[data-testid="sidebar-logout"]') as HTMLAnchorElement | null;
    expect(logout).toBeTruthy();
    expect(logout?.getAttribute('href')).toBe('/api/oauth/logout');
    expect(logout?.textContent).toContain('登出');
  });

  it('未登入時不顯示「登出」link', () => {
    const { container } = renderSidebar({ user: null });
    expect(container.querySelector('[data-testid="sidebar-logout"]')).toBeNull();
  });

  it('已登入時 nav 隱藏「登入」item（已有 user chip + 登出，避免重複）', () => {
    const { container } = renderSidebar({
      user: { name: 'Ray', email: 'ray@trip.io' },
    });
    const nav = container.querySelector('[aria-label="主要功能"]');
    expect(nav?.textContent).not.toContain('登入');
    // 其他可見 nav item 仍在（聊天 + 地圖 是 Phase 3 placeholder，依然隱藏）
    expect(nav?.textContent).toContain('行程');
    expect(nav?.textContent).toContain('探索');
    expect(nav?.textContent).toContain('已連結應用');
    expect(nav?.textContent).toContain('開發者');
    expect(nav?.textContent).not.toContain('聊天');
    expect(nav?.textContent).not.toContain('地圖');
  });

  it('未登入時 nav 顯示「登入」item', () => {
    const { container } = renderSidebar({ user: null });
    const nav = container.querySelector('[aria-label="主要功能"]');
    expect(nav?.textContent).toContain('登入');
  });
});

describe('DesktopSidebar — New Trip CTA', () => {
  let onNewTripMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    onNewTripMock = vi.fn();
  });

  it('sidebar 底部有「新增行程」CTA button', () => {
    const { getByTestId } = renderSidebar({ onNewTrip: onNewTripMock });
    expect(getByTestId('sidebar-new-trip-btn').textContent).toContain('新增行程');
  });

  it('點擊 CTA 觸發 onNewTrip callback', () => {
    const { getByTestId } = renderSidebar({ onNewTrip: onNewTripMock });
    fireEvent.click(getByTestId('sidebar-new-trip-btn'));
    expect(onNewTripMock).toHaveBeenCalledTimes(1);
  });
});
