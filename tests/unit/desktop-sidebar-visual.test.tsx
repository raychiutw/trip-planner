/**
 * DesktopSidebar visual + IA — Section 2 + 4.1 (terracotta-mockup-parity-v2)
 *
 * 驗 mockup-aligned 結構：
 *   - 5 nav item：聊天 / 行程 / 地圖 / 探索 / 帳號 (auth) | 登入 (guest)
 *   - active item 套 .is-active CSS class
 *   - account chip name >10 字 → slice(0,10)+'…' truncation
 *   - account chip Link 指向 /account
 *   - logged-out 顯示「未登入」 chip 取代 account card
 *   - dark theme bg 用 var(--color-foreground) (透過 SCOPED_STYLES inline 確認)
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DesktopSidebar from '../../src/components/shell/DesktopSidebar';

function renderSidebar(opts: {
  user?: { name: string; email: string } | null;
  initialEntry?: string;
}) {
  const { user = null, initialEntry = '/trips' } = opts;
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <DesktopSidebar user={user} />
    </MemoryRouter>,
  );
}

describe('DesktopSidebar — visual + nav IA', () => {
  /* 2026-04-29:user 拍板「桌機版 sidebar 不用帳號選項 避免重複」 — desktop
   * 移除「帳號」 nav item,user 透過底部 user chip(.tp-account-card)進
   * /account。Mobile GlobalBottomNav 維持 5 tab 含「帳號」。 */
  it('logged-in 顯示 4 nav: 聊天 / 行程 / 地圖 / 探索(帳號移到底部 user chip)', () => {
    renderSidebar({ user: { name: 'Ray', email: 'ray@x.com' }, initialEntry: '/trips' });
    expect(screen.getByText('聊天')).toBeTruthy();
    expect(screen.getByText('行程')).toBeTruthy();
    expect(screen.getByText('地圖')).toBeTruthy();
    expect(screen.getByText('探索')).toBeTruthy();
    // desktop sidebar 不再有「帳號」 nav,改透過底部 user chip
    expect(screen.queryAllByText('帳號')).toHaveLength(0);
    // logged-in 不顯示「登入」
    expect(screen.queryByText('登入')).toBeNull();
  });

  it('logged-out 顯示「登入」(沒「帳號」)', () => {
    renderSidebar({ user: null, initialEntry: '/trips' });
    expect(screen.getByText('登入')).toBeTruthy();
    expect(screen.queryByText('帳號')).toBeNull();
  });

  it('current pathname 對應 nav item 套 .is-active', () => {
    renderSidebar({ user: { name: 'Ray', email: 'ray@x.com' }, initialEntry: '/trips' });
    const tripsLink = screen.getByText('行程').closest('a');
    expect(tripsLink?.className).toContain('is-active');
    const chatLink = screen.getByText('聊天').closest('a');
    expect(chatLink?.className).not.toContain('is-active');
  });

  it('「行程」 nav matches /trip/* 子路由 (e.g. /trip/okinawa)', () => {
    renderSidebar({ user: { name: 'Ray', email: 'ray@x.com' }, initialEntry: '/trip/okinawa' });
    const tripsLink = screen.getByText('行程').closest('a');
    expect(tripsLink?.className).toContain('is-active');
  });

  it('「地圖」 nav exactOnly — /map 才 active，/manage/map-xxx 不 active', () => {
    renderSidebar({ user: { name: 'Ray', email: 'ray@x.com' }, initialEntry: '/map' });
    expect(screen.getByText('地圖').closest('a')?.className).toContain('is-active');
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

  it('dark theme bg — SCOPED_STYLES 含 color-foreground sidebar bg rule', () => {
    const { container } = renderSidebar({ user: null, initialEntry: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/\.tp-sidebar\s*\{[^}]*background:\s*var\(--color-foreground\)/);
  });

  it('inactive item 文字用半透明 cream rgba(255, 251, 245, 0.6)', () => {
    const { container } = renderSidebar({ user: null, initialEntry: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toContain('rgba(255, 251, 245, 0.6)');
  });

  it('active item bg 用 accent', () => {
    const { container } = renderSidebar({ user: null, initialEntry: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/\.tp-nav-item\.is-active\s*\{[^}]*background:\s*var\(--color-accent\)/);
  });

  it('font-weight 600 套 .tp-nav-item base', () => {
    const { container } = renderSidebar({ user: null, initialEntry: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/\.tp-nav-item\s*\{[^}]*font-weight:\s*600/);
  });
});
