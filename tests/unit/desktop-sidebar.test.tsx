/**
 * DesktopSidebar — B-P2 §3
 *
 * 5 nav items（聊天 / 行程 / 地圖 / 探索 / 登入）+ user chip + New Trip CTA。
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

describe('DesktopSidebar — 5 nav items', () => {
  it('§3.1 渲染 5 個 nav items 順序為 聊天 / 行程 / 地圖 / 探索 / 登入', () => {
    const { getAllByRole } = renderSidebar();
    const links = getAllByRole('link');
    expect(links.length).toBe(5);
    expect(links[0].textContent).toContain('聊天');
    expect(links[1].textContent).toContain('行程');
    expect(links[2].textContent).toContain('地圖');
    expect(links[3].textContent).toContain('探索');
    expect(links[4].textContent).toContain('登入');
  });

  it('§3.1 nav items href 對應 /chat /manage /map /explore /login', () => {
    const { getAllByRole } = renderSidebar();
    const links = getAllByRole('link') as HTMLAnchorElement[];
    expect(links[0].getAttribute('href')).toBe('/chat');
    expect(links[1].getAttribute('href')).toBe('/manage');
    expect(links[2].getAttribute('href')).toBe('/map');
    expect(links[3].getAttribute('href')).toBe('/explore');
    expect(links[4].getAttribute('href')).toBe('/login');
  });
});

describe('DesktopSidebar — active state', () => {
  it('§3.2 路由 /manage 時「行程」item 有 is-active class', () => {
    const { getAllByRole } = renderSidebar({ path: '/manage' });
    const links = getAllByRole('link');
    expect(links[1].className).toMatch(/is-active/);
    // 其他 4 個不該 active
    expect(links[0].className).not.toMatch(/is-active/);
    expect(links[2].className).not.toMatch(/is-active/);
    expect(links[3].className).not.toMatch(/is-active/);
    expect(links[4].className).not.toMatch(/is-active/);
  });

  it('§3.3 路由 /trip/abc 時「行程」item 仍 active（trip 屬於行程 scope）', () => {
    const { getAllByRole } = renderSidebar({ path: '/trip/abc' });
    const links = getAllByRole('link');
    expect(links[1].className).toMatch(/is-active/);
  });

  it('§3.3 路由 /trip/abc/map 時「行程」item active（per-trip sub-route）', () => {
    const { getAllByRole } = renderSidebar({ path: '/trip/abc/map' });
    const links = getAllByRole('link');
    expect(links[1].className).toMatch(/is-active/);
    // /map nav item 是 cross-trip global，per-trip 的 sub-route 不該讓它 active
    expect(links[2].className).not.toMatch(/is-active/);
  });

  it('§3.2 路由 /chat 時「聊天」item active', () => {
    const { getAllByRole } = renderSidebar({ path: '/chat' });
    const links = getAllByRole('link');
    expect(links[0].className).toMatch(/is-active/);
  });

  it('§3.2 路由 /map 時「地圖」item active（cross-trip global）', () => {
    const { getAllByRole } = renderSidebar({ path: '/map' });
    const links = getAllByRole('link');
    expect(links[2].className).toMatch(/is-active/);
  });

  it('§3.2 路由 /explore 時「探索」item active', () => {
    const { getAllByRole } = renderSidebar({ path: '/explore' });
    const links = getAllByRole('link');
    expect(links[3].className).toMatch(/is-active/);
  });

  it('§3.2 路由 /login 或 sub-route 時「登入」item active', () => {
    const { getAllByRole } = renderSidebar({ path: '/login/forgot' });
    const links = getAllByRole('link');
    expect(links[4].className).toMatch(/is-active/);
  });
});

describe('DesktopSidebar — user chip', () => {
  it('§3.4 未登入：user chip 顯示「未登入」', () => {
    const { container } = renderSidebar({ user: null });
    const chip = container.querySelector('[data-testid="sidebar-user-chip"]');
    expect(chip?.textContent).toContain('未登入');
  });

  it('§3.4 已登入：顯示帳號 chip 含 name + email', () => {
    const { container } = renderSidebar({
      user: { name: 'Ray Chiu', email: 'ray@trip.io' },
    });
    const chip = container.querySelector('[data-testid="sidebar-account-card"]');
    expect(chip).toBeTruthy();
    expect(chip?.textContent).toContain('Ray Chiu');
    expect(chip?.textContent).toContain('ray@trip.io');
  });

  it('§3.4 已登入時不顯示「未登入」chip', () => {
    const { container } = renderSidebar({
      user: { name: 'Ray', email: 'ray@trip.io' },
    });
    expect(container.querySelector('[data-testid="sidebar-user-chip"]')).toBeNull();
  });
});

describe('DesktopSidebar — New Trip CTA', () => {
  let onNewTripMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    onNewTripMock = vi.fn();
  });

  it('§3.5 sidebar 底部有「新增行程」CTA button', () => {
    const { getByTestId } = renderSidebar({ onNewTrip: onNewTripMock });
    expect(getByTestId('sidebar-new-trip-btn').textContent).toContain('新增行程');
  });

  it('§3.5 點擊 CTA 觸發 onNewTrip callback', () => {
    const { getByTestId } = renderSidebar({ onNewTrip: onNewTripMock });
    fireEvent.click(getByTestId('sidebar-new-trip-btn'));
    expect(onNewTripMock).toHaveBeenCalledTimes(1);
  });
});
