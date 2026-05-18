/**
 * DesktopSidebar — visual reference: docs/design-sessions/mockup-trip-v2.html
 *
 * v2.31.81 (user batch UX fixes)：sidebar 全 icon-only。
 * Primary nav (anonymous)：聊天 / 探索 / 地圖 / 收藏 / 切換行程 / 登入（6 items）。
 * Logged-in 隱藏「登入」（account 走 sidebar 底部 chip）→ 5 items。
 * 「行程」 nav 移除（取代為「切換行程」，相同 /trips href + TRIP_ACTIVE_PATTERNS active 條件）。
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DesktopSidebar from '../../src/components/shell/DesktopSidebar';

function renderSidebar(opts: {
  path?: string;
  user?: { name: string; email: string } | null | undefined;
  isAdmin?: boolean;
} = {}) {
  const user = Object.prototype.hasOwnProperty.call(opts, 'user') ? opts.user : null;
  return render(
    <MemoryRouter initialEntries={[opts.path ?? '/trips']}>
      <DesktopSidebar
        user={user}
        isAdmin={opts.isAdmin ?? false}
      />
    </MemoryRouter>,
  );
}

describe('DesktopSidebar — visible nav items (anonymous)', () => {
  it('renders 6 nav items: 聊天 / 探索 / 地圖 / 收藏 / 切換行程 / 登入', () => {
    const { getAllByRole } = renderSidebar();
    const links = getAllByRole('link');
    expect(links.length).toBe(6);
    expect(links[0]?.getAttribute('aria-label')).toBe('聊天');
    expect(links[1]?.getAttribute('aria-label')).toBe('探索');
    expect(links[2]?.getAttribute('aria-label')).toBe('地圖');
    expect(links[3]?.getAttribute('aria-label')).toBe('收藏');
    expect(links[4]?.getAttribute('aria-label')).toBe('切換行程');
    expect(links[5]?.getAttribute('aria-label')).toBe('登入');
  });

  it('nav items href 對應 IA', () => {
    const { getAllByRole } = renderSidebar();
    const links = getAllByRole('link') as HTMLAnchorElement[];
    expect(links[0]?.getAttribute('href')).toBe('/chat');
    expect(links[1]?.getAttribute('href')).toBe('/explore');
    expect(links[2]?.getAttribute('href')).toBe('/map');
    expect(links[3]?.getAttribute('href')).toBe('/favorites');
    expect(links[4]?.getAttribute('href')).toBe('/trips');
    expect(links[5]?.getAttribute('href')).toBe('/login');
  });

  it('settings + developer keys 已從 primary nav 移除', () => {
    const { container } = renderSidebar();
    const nav = container.querySelector('[aria-label="主要功能"]');
    expect(nav?.textContent).not.toContain('已連結應用');
    expect(nav?.textContent).not.toContain('開發者');
  });

  it('auth loading 時只顯示 5 個 primary nav，不先顯示「登入」', () => {
    const { container, getAllByRole } = renderSidebar({ user: undefined });
    const links = getAllByRole('link');
    expect(links.length).toBe(5);
    expect(links[0]?.getAttribute('aria-label')).toBe('聊天');
    expect(links[1]?.getAttribute('aria-label')).toBe('探索');
    expect(links[2]?.getAttribute('aria-label')).toBe('地圖');
    expect(links[3]?.getAttribute('aria-label')).toBe('收藏');
    expect(links[4]?.getAttribute('aria-label')).toBe('切換行程');

    const nav = container.querySelector('[aria-label="主要功能"]');
    // v2.31.81：label 隱藏於 sr-only span，但 textContent 仍 surface 給 screen reader。
    // 確認 nav 區段不含「登入」相關 aria-label（用 link role 比 textContent 更精準）。
    const loginLink = container.querySelector('a[href="/login"]');
    expect(loginLink).toBeNull();
  });
});

describe('DesktopSidebar — active state', () => {
  it('路由 /trips 時「切換行程」item active（取代舊「行程」 nav）', () => {
    const { getAllByRole } = renderSidebar({ path: '/trips' });
    const links = getAllByRole('link');
    // index 4 = 切換行程
    expect(links[4]?.className).toMatch(/is-active/);
    expect(links[0]?.className).not.toMatch(/is-active/);
    expect(links[3]?.className).not.toMatch(/is-active/);
  });

  it('路由 /chat 時「聊天」item active', () => {
    const { getAllByRole } = renderSidebar({ path: '/chat' });
    const links = getAllByRole('link');
    expect(links[0]?.className).toMatch(/is-active/);
  });

  it('PR-O 後 admin user 也不再看到「管理」nav item（已搬進每個行程的共編 sheet）', () => {
    const { container } = renderSidebar({
      path: '/trips',
      user: { name: 'Admin', email: 'admin@trip.io' },
      isAdmin: true,
    });
    const nav = container.querySelector('[aria-label="主要功能"]');
    expect(nav?.textContent).not.toContain('管理');
  });

  it('non-admin user 不顯示「管理」nav item', () => {
    const { container } = renderSidebar({
      user: { name: 'Plain', email: 'plain@x.com' },
      isAdmin: false,
    });
    const nav = container.querySelector('[aria-label="主要功能"]');
    expect(nav?.textContent).not.toContain('管理');
  });

  it('路由 /trip/abc 時「切換行程」item 仍 active（trip-scoped sub-route）', () => {
    const { getAllByRole } = renderSidebar({ path: '/trip/abc' });
    const links = getAllByRole('link');
    expect(links[4]?.className).toMatch(/is-active/);
  });

  it('路由 /trip/abc/map 時「地圖」item active（in-trip map route）', () => {
    const { getAllByRole } = renderSidebar({ path: '/trip/abc/map' });
    const links = getAllByRole('link');
    expect(links[2]?.className).toMatch(/is-active/);
    expect(links[4]?.className).not.toMatch(/is-active/);
  });

  it('路由 /trip/abc/map/ trailing slash 時「地圖」item active', () => {
    const { getAllByRole } = renderSidebar({ path: '/trip/abc/map/' });
    const links = getAllByRole('link');
    expect(links[2]?.className).toMatch(/is-active/);
    expect(links[4]?.className).not.toMatch(/is-active/);
  });

  it('路由 /trip/abc/stop/101/map 時「地圖」item active', () => {
    const { getAllByRole } = renderSidebar({ path: '/trip/abc/stop/101/map' });
    const links = getAllByRole('link');
    expect(links[2]?.className).toMatch(/is-active/);
    expect(links[4]?.className).not.toMatch(/is-active/);
  });

  it('路由 /trip/abc/stop/101/map/ trailing slash 時「地圖」item active', () => {
    const { getAllByRole } = renderSidebar({ path: '/trip/abc/stop/101/map/' });
    const links = getAllByRole('link');
    expect(links[2]?.className).toMatch(/is-active/);
    expect(links[4]?.className).not.toMatch(/is-active/);
  });

  it('路由 /trip/abc/stop/101/copy 時「切換行程」item active', () => {
    const { getAllByRole } = renderSidebar({ path: '/trip/abc/stop/101/copy' });
    const links = getAllByRole('link');
    expect(links[4]?.className).toMatch(/is-active/);
    expect(links[2]?.className).not.toMatch(/is-active/);
  });

  it('路由 /map 時只有「地圖」global view active，「切換行程」沒 active', () => {
    const { getAllByRole } = renderSidebar({ path: '/map' });
    const links = getAllByRole('link');
    expect(links[2]?.className).toMatch(/is-active/);
    expect(links[4]?.className).not.toMatch(/is-active/);
  });

  it('路由 /favorites 時「收藏」item active', () => {
    const { getAllByRole } = renderSidebar({ path: '/favorites' });
    const links = getAllByRole('link');
    expect(links[3]?.className).toMatch(/is-active/);
  });

  it('路由 /explore 時「探索」item active（v2.31.81：探索 surface 為 primary nav icon）', () => {
    const { getAllByRole } = renderSidebar({ path: '/explore' });
    const links = getAllByRole('link');
    expect(links[1]?.className).toMatch(/is-active/);
  });

  it('路由 /login 或 sub-route 時「登入」item active', () => {
    const { getAllByRole } = renderSidebar({ path: '/login/forgot' });
    const links = getAllByRole('link');
    expect(links[5]?.className).toMatch(/is-active/);
  });
});

describe('DesktopSidebar — user chip', () => {
  it('未登入：user chip 顯示「未登入」', () => {
    const { container } = renderSidebar({ user: null });
    const chip = container.querySelector('[data-testid="sidebar-user-chip"]');
    expect(chip?.textContent).toContain('未登入');
  });

  it('已登入：顯示帳號 chip 含 name（不含 email — 2026-05-07 移除）', () => {
    const { container } = renderSidebar({
      user: { name: 'Ray Chiu', email: 'ray@trip.io' },
    });
    const chip = container.querySelector('[data-testid="sidebar-account-card"]');
    expect(chip).toBeTruthy();
    expect(chip?.textContent).toContain('Ray Chiu');
    expect(chip?.textContent).not.toContain('ray@trip.io');
  });

  it('已登入時不顯示「未登入」chip', () => {
    const { container } = renderSidebar({
      user: { name: 'Ray', email: 'ray@trip.io' },
    });
    expect(container.querySelector('[data-testid="sidebar-user-chip"]')).toBeNull();
  });

  // /devex-review 2026-04-26：sidebar 不再放「登出」link，避免 destructive
  // action 暴露在主要 nav 區。登出走 /settings/sessions 內的 device row revoke。
  it('已登入：sidebar 不放「登出」link', () => {
    const { container } = renderSidebar({
      user: { name: 'Ray', email: 'ray@trip.io' },
    });
    expect(container.querySelector('[data-testid="sidebar-logout"]')).toBeNull();
  });

  it('未登入時也不顯示「登出」link', () => {
    const { container } = renderSidebar({ user: null });
    expect(container.querySelector('[data-testid="sidebar-logout"]')).toBeNull();
  });

  it('已登入時 nav 隱藏「登入」item — account chip 取代', () => {
    const { container, getAllByRole } = renderSidebar({
      user: { name: 'Ray', email: 'ray@trip.io' },
    });
    const links = getAllByRole('link');
    // 5 個 primary nav (no 登入) — 聊天 / 探索 / 地圖 / 收藏 / 切換行程
    expect(links.length).toBeGreaterThanOrEqual(5);
    expect(container.querySelector('a[href="/login"]')).toBeNull();
    expect(container.querySelector('a[href="/chat"]')).toBeTruthy();
    expect(container.querySelector('a[href="/explore"]')).toBeTruthy();
    expect(container.querySelector('a[href="/map"]')).toBeTruthy();
    expect(container.querySelector('a[href="/favorites"]')).toBeTruthy();
    expect(container.querySelector('a[href="/trips"]')).toBeTruthy();
  });

  it('未登入時 nav 顯示「登入」item', () => {
    const { container } = renderSidebar({ user: null });
    expect(container.querySelector('a[href="/login"]')).toBeTruthy();
  });

  it('auth loading 時保留 sidebar 底部高度，但不顯示「未登入」或 account card', () => {
    const { container } = renderSidebar({ user: undefined });
    expect(container.querySelector('[data-testid="sidebar-user-loading"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="sidebar-user-chip"]')).toBeNull();
    expect(container.querySelector('[data-testid="sidebar-account-card"]')).toBeNull();
    expect(container.textContent).not.toContain('未登入');
  });
});

describe('DesktopSidebar — sidebar 不再有「+ 新增行程」CTA（user direction 2026-04-26）', () => {
  it('未登入時 sidebar 沒有 sidebar-new-trip-btn', () => {
    const { queryByTestId } = renderSidebar();
    expect(queryByTestId('sidebar-new-trip-btn')).toBeNull();
  });

  it('已登入時 sidebar 也沒有 sidebar-new-trip-btn — 入口改在 TripsListPage / GlobalMap empty state', () => {
    const { queryByTestId } = renderSidebar({
      user: { name: 'Ray', email: 'ray@trip.io' },
    });
    expect(queryByTestId('sidebar-new-trip-btn')).toBeNull();
  });
});
