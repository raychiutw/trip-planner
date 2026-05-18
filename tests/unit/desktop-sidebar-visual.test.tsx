/**
 * DesktopSidebar visual + IA — v2.31.81 user batch UX fixes（sidebar all icon-only）。
 *
 * Primary nav (logged-in)：聊天 / 探索 / 地圖 / 收藏 / 切換行程（5 items）。
 * Anonymous 多 1 個「登入」 = 6 items。「行程」 nav 移除（取代為「切換行程」）。
 * Label 隱藏於 sr-only span（visually hidden）；aria-label / title 仍 expose 給
 * screen reader + tooltip。
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DesktopSidebar from '../../src/components/shell/DesktopSidebar';

function renderSidebar(opts: {
  user?: { name: string; email: string } | null | undefined;
  initialEntry?: string;
}) {
  const user = Object.prototype.hasOwnProperty.call(opts, 'user') ? opts.user : null;
  const { initialEntry = '/trips' } = opts;
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <DesktopSidebar user={user} />
    </MemoryRouter>,
  );
}

describe('DesktopSidebar — visual + nav IA', () => {
  it('logged-in 顯示 5 nav: 聊天 / 探索 / 地圖 / 收藏 / 切換行程（v2.31.81 icon-only IA）', () => {
    const { container } = renderSidebar({ user: { name: 'Ray', email: 'ray@x.com' }, initialEntry: '/trips' });
    // aria-label 是 screen reader 真實 label，比 text 更穩
    const navLinks = container.querySelectorAll('nav[aria-label="主要功能"] a');
    expect(navLinks.length).toBe(5);
    expect(navLinks[0]?.getAttribute('aria-label')).toBe('聊天');
    expect(navLinks[1]?.getAttribute('aria-label')).toBe('探索');
    expect(navLinks[2]?.getAttribute('aria-label')).toBe('地圖');
    expect(navLinks[3]?.getAttribute('aria-label')).toBe('收藏');
    expect(navLinks[4]?.getAttribute('aria-label')).toBe('切換行程');
    // desktop sidebar 不再有「帳號」 nav,改透過底部 user chip
    expect(container.querySelector('a[aria-label="帳號"]')).toBeNull();
    // logged-in 不顯示「登入」
    expect(container.querySelector('a[aria-label="登入"]')).toBeNull();
  });

  it('logged-out 多顯示「登入」 icon（共 6 個 nav item）', () => {
    const { container } = renderSidebar({ user: null, initialEntry: '/trips' });
    const navLinks = container.querySelectorAll('nav[aria-label="主要功能"] a');
    expect(navLinks.length).toBe(6);
    expect(navLinks[5]?.getAttribute('aria-label')).toBe('登入');
  });

  it('auth loading 不顯示「登入」「未登入」或「帳號」', () => {
    const { container } = renderSidebar({ user: undefined, initialEntry: '/trips' });
    expect(container.querySelector('a[aria-label="登入"]')).toBeNull();
    expect(container.textContent).not.toContain('未登入');
    expect(screen.queryByTestId('sidebar-account-card')).toBeNull();
    expect(screen.getByTestId('sidebar-user-loading')).toBeTruthy();
  });

  it('current pathname 對應 nav item 套 .is-active（/trips → 切換行程）', () => {
    const { container } = renderSidebar({ user: { name: 'Ray', email: 'ray@x.com' }, initialEntry: '/trips' });
    const switchTripLink = container.querySelector('a[aria-label="切換行程"]');
    expect(switchTripLink?.className).toContain('is-active');
    const chatLink = container.querySelector('a[aria-label="聊天"]');
    expect(chatLink?.className).not.toContain('is-active');
  });

  it('「切換行程」 nav matches non-map /trip/* 子路由 (e.g. /trip/okinawa)', () => {
    const { container } = renderSidebar({ user: { name: 'Ray', email: 'ray@x.com' }, initialEntry: '/trip/okinawa' });
    const switchTripLink = container.querySelector('a[aria-label="切換行程"]');
    expect(switchTripLink?.className).toContain('is-active');
  });

  it('「地圖」 nav matches /trip/:id/map and does not also activate 切換行程', () => {
    const { container } = renderSidebar({ user: { name: 'Ray', email: 'ray@x.com' }, initialEntry: '/trip/okinawa/map' });
    expect(container.querySelector('a[aria-label="地圖"]')?.className).toContain('is-active');
    expect(container.querySelector('a[aria-label="切換行程"]')?.className).not.toContain('is-active');
  });

  it('「地圖」 nav exactOnly — /map 才 active', () => {
    const { container } = renderSidebar({ user: { name: 'Ray', email: 'ray@x.com' }, initialEntry: '/map' });
    expect(container.querySelector('a[aria-label="地圖"]')?.className).toContain('is-active');
  });

  it('account chip name >10 字 → slice(0,10)+「…」 truncation', () => {
    renderSidebar({
      user: { name: '王大華王大華王大華王大華王大華王大華', email: 'long@x.com' },
      initialEntry: '/trips',
    });
    const card = screen.getByTestId('sidebar-account-card');
    const nameEl = card.querySelector('.tp-account-name');
    expect(nameEl?.textContent).toMatch(/…$/);
    expect((nameEl?.textContent ?? '').length).toBeLessThanOrEqual(11); // 10 + '…'
  });

  it('account chip name ≤10 字 → 不 truncation', () => {
    renderSidebar({ user: { name: 'Ray Chiu', email: 'ray@x.com' }, initialEntry: '/trips' });
    const card = screen.getByTestId('sidebar-account-card');
    const nameEl = card.querySelector('.tp-account-name');
    expect(nameEl?.textContent).toBe('Ray Chiu');
  });

  it('account chip Link 指向 /account', () => {
    renderSidebar({ user: { name: 'Ray', email: 'ray@x.com' }, initialEntry: '/trips' });
    const card = screen.getByTestId('sidebar-account-card') as HTMLAnchorElement;
    expect(card.getAttribute('href')).toBe('/account');
  });

  it('logged-out 顯示「未登入」 chip 取代 account card', () => {
    renderSidebar({ user: null, initialEntry: '/trips' });
    expect(screen.queryByTestId('sidebar-account-card')).toBeNull();
    expect(screen.getByTestId('sidebar-user-chip').textContent).toContain('未登入');
  });

  it('dark theme bg — SCOPED_STYLES 固定 deep-cocoa light/dark 背景', () => {
    const { container } = renderSidebar({ user: null, initialEntry: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/\.tp-sidebar\s*\{[^}]*background:\s*#2A1F18/);
    expect(style).toMatch(/body\.dark \.tp-sidebar\s*\{[^}]*background:\s*#0F0B08/);
  });

  it('inactive item 文字用 mockup 半透明 cream rgba(255, 251, 245, 0.78)', () => {
    const { container } = renderSidebar({ user: null, initialEntry: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toContain('rgba(255, 251, 245, 0.78)');
  });

  it('active item bg 用 accent', () => {
    const { container } = renderSidebar({ user: null, initialEntry: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/\.tp-nav-item\.is-active\s*\{[^}]*background:\s*var\(--color-accent\)/);
  });

  it('v2.31.81：nav item icon-only — label sr-only hidden, aria-label + title 仍 expose', () => {
    const { container } = renderSidebar({ user: null, initialEntry: '/trips' });
    const navLink = container.querySelector('a[aria-label="聊天"]') as HTMLAnchorElement;
    expect(navLink).toBeTruthy();
    expect(navLink.getAttribute('title')).toBe('聊天');
    // label 在 sr-only span 內
    const labelSpan = navLink.querySelector('.tp-nav-item-label');
    expect(labelSpan?.textContent).toBe('聊天');
    // SCOPED_STYLES 含 sr-only class
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/\.tp-nav-item-label\s*\{[^}]*position:\s*absolute/);
    expect(style).toMatch(/\.tp-nav-item-label\s*\{[^}]*clip:\s*rect\(0,\s*0,\s*0,\s*0\)/);
  });
});
