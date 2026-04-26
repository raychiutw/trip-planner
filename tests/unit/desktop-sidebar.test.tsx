/**
 * DesktopSidebar — visual reference: docs/design-sessions/mockup-trip-v2.html
 *
 * Mockup 5-item primary nav: 聊天 / 行程 / 地圖 / 探索 / 登入.
 * Anonymous: all 5 visible. Logged-in: 4 (登入 hidden, replaced by account chip + 登出).
 * Settings (connected-apps / developer/apps / sessions) reach via direct URL,
 * not primary nav.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DesktopSidebar from '../../src/components/shell/DesktopSidebar';

function renderSidebar(opts: {
  path?: string;
  user?: { name: string; email: string } | null;
  isAdmin?: boolean;
} = {}) {
  return render(
    <MemoryRouter initialEntries={[opts.path ?? '/trips']}>
      <DesktopSidebar
        user={opts.user ?? null}
        isAdmin={opts.isAdmin ?? false}
      />
    </MemoryRouter>,
  );
}

describe('DesktopSidebar — visible nav items (anonymous)', () => {
  it('renders 5 nav items: 聊天 / 行程 / 地圖 / 探索 / 登入', () => {
    const { getAllByRole } = renderSidebar();
    const links = getAllByRole('link');
    expect(links.length).toBe(5);
    expect(links[0].textContent).toContain('聊天');
    expect(links[1].textContent).toContain('行程');
    expect(links[2].textContent).toContain('地圖');
    expect(links[3].textContent).toContain('探索');
    expect(links[4].textContent).toContain('登入');
  });

  it('nav items href 對應 mockup IA', () => {
    const { getAllByRole } = renderSidebar();
    const links = getAllByRole('link') as HTMLAnchorElement[];
    expect(links[0].getAttribute('href')).toBe('/chat');
    expect(links[1].getAttribute('href')).toBe('/trips');
    expect(links[2].getAttribute('href')).toBe('/map');
    expect(links[3].getAttribute('href')).toBe('/explore');
    expect(links[4].getAttribute('href')).toBe('/login');
  });

  it('settings + developer keys 已從 primary nav 移除', () => {
    const { container } = renderSidebar();
    const nav = container.querySelector('[aria-label="主要功能"]');
    expect(nav?.textContent).not.toContain('已連結應用');
    expect(nav?.textContent).not.toContain('開發者');
  });
});

describe('DesktopSidebar — active state', () => {
  it('路由 /trips 時「行程」item active', () => {
    const { getAllByRole } = renderSidebar({ path: '/trips' });
    const links = getAllByRole('link');
    // index 1 = 行程
    expect(links[1].className).toMatch(/is-active/);
    expect(links[0].className).not.toMatch(/is-active/);
    expect(links[3].className).not.toMatch(/is-active/);
  });

  it('路由 /chat 時「聊天」item active（取代舊 /manage editor）', () => {
    const { getAllByRole } = renderSidebar({ path: '/chat' });
    const links = getAllByRole('link');
    expect(links[0].className).toMatch(/is-active/);
  });

  it('admin user 看到「管理」nav item，且在 /admin 時 active', () => {
    const { getAllByRole } = renderSidebar({
      path: '/admin',
      user: { name: 'Admin', email: 'admin@trip.io' },
      isAdmin: true,
    });
    const links = getAllByRole('link');
    const labels = links.map((l) => l.textContent ?? '');
    const manageIdx = labels.findIndex((t) => t.includes('管理'));
    expect(manageIdx).toBeGreaterThanOrEqual(0);
    expect(links[manageIdx]?.className).toMatch(/is-active/);
  });

  it('non-admin user 不顯示「管理」nav item', () => {
    const { container } = renderSidebar({
      user: { name: 'Plain', email: 'plain@x.com' },
      isAdmin: false,
    });
    const nav = container.querySelector('[aria-label="主要功能"]');
    expect(nav?.textContent).not.toContain('管理');
  });

  it('路由 /trip/abc 時「行程」item 仍 active', () => {
    const { getAllByRole } = renderSidebar({ path: '/trip/abc' });
    const links = getAllByRole('link');
    expect(links[1].className).toMatch(/is-active/);
  });

  it('路由 /trip/abc/map 時「行程」item active（per-trip sub-route，不轉到全域 /map）', () => {
    const { getAllByRole } = renderSidebar({ path: '/trip/abc/map' });
    const links = getAllByRole('link');
    expect(links[1].className).toMatch(/is-active/);
    expect(links[2].className).not.toMatch(/is-active/);
  });

  it('路由 /map 時只有「地圖」global view active，「行程」沒 active', () => {
    const { getAllByRole } = renderSidebar({ path: '/map' });
    const links = getAllByRole('link');
    expect(links[2].className).toMatch(/is-active/);
    expect(links[1].className).not.toMatch(/is-active/);
  });

  it('路由 /chat 時「聊天」item active', () => {
    const { getAllByRole } = renderSidebar({ path: '/chat' });
    const links = getAllByRole('link');
    expect(links[0].className).toMatch(/is-active/);
  });

  it('路由 /explore 時「探索」item active', () => {
    const { getAllByRole } = renderSidebar({ path: '/explore' });
    const links = getAllByRole('link');
    expect(links[3].className).toMatch(/is-active/);
  });

  it('路由 /login 或 sub-route 時「登入」item active', () => {
    const { getAllByRole } = renderSidebar({ path: '/login/forgot' });
    const links = getAllByRole('link');
    expect(links[4].className).toMatch(/is-active/);
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
    const { container } = renderSidebar({
      user: { name: 'Ray', email: 'ray@trip.io' },
    });
    const nav = container.querySelector('[aria-label="主要功能"]');
    expect(nav?.textContent).not.toContain('登入');
    // Other 4 items still visible
    expect(nav?.textContent).toContain('聊天');
    expect(nav?.textContent).toContain('行程');
    expect(nav?.textContent).toContain('地圖');
    expect(nav?.textContent).toContain('探索');
  });

  it('未登入時 nav 顯示「登入」item', () => {
    const { container } = renderSidebar({ user: null });
    const nav = container.querySelector('[aria-label="主要功能"]');
    expect(nav?.textContent).toContain('登入');
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
