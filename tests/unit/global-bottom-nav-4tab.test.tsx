/**
 * GlobalBottomNav 4-tab unit test — rev2「手機也做」（owner 2026-07-18）
 *
 * 底部 nav 由 5-tab 降 4-tab：聊天 / 行程 / 地圖 / 收藏（帳號/登入 移出 tab slot →
 * 手機統一 header 右上帳號圓圈 <AccountCircle/>、桌機 sidebar 左下 chip）。
 * 對齊 mockup「4 格：帳號移到 titlebar 右上，不佔 tab slot」。
 *   - authed / anon 皆 4 tab（無帳號、無登入）
 *   - 「地圖」 active 對 /map + /trip/:id/map（不對 /manage/map-xxx）
 *   - 「行程」 active 對 /trips + /trip/:id（不對 /trip/:id/map）
 *   - 觸控目標 ≥44px
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GlobalBottomNav from '../../src/components/shell/GlobalBottomNav';

function renderNav(opts: { authed: boolean; pathname: string }) {
  return render(
    <MemoryRouter initialEntries={[opts.pathname]}>
      <GlobalBottomNav authed={opts.authed} />
    </MemoryRouter>,
  );
}

describe('GlobalBottomNav — 4-tab IA（rev2 帳號移 header）', () => {
  it('logged-in render 4 tabs：聊天 / 行程 / 地圖 / 收藏（無帳號 tab）', () => {
    renderNav({ authed: true, pathname: '/trips' });
    expect(screen.getByTestId('global-bottom-nav-chat')).toBeTruthy();
    expect(screen.getByTestId('global-bottom-nav-trips')).toBeTruthy();
    expect(screen.getByTestId('global-bottom-nav-map')).toBeTruthy();
    expect(screen.getByTestId('global-bottom-nav-favorites')).toBeTruthy();
    // 帳號/登入 移出 tab slot → header 帳號圓圈
    expect(screen.queryByTestId('global-bottom-nav-account')).toBeNull();
    expect(screen.queryByTestId('global-bottom-nav-login')).toBeNull();
  });

  it('logged-out 也 4 tab（無登入 tab；登入入口在 header 帳號圓圈）', () => {
    renderNav({ authed: false, pathname: '/trips' });
    expect(screen.getByTestId('global-bottom-nav-chat')).toBeTruthy();
    expect(screen.getByTestId('global-bottom-nav-favorites')).toBeTruthy();
    expect(screen.queryByTestId('global-bottom-nav-login')).toBeNull();
    expect(screen.queryByTestId('global-bottom-nav-account')).toBeNull();
  });

  it('nav 只 render 4 個連結（無帳號/登入）', () => {
    const { container } = renderNav({ authed: true, pathname: '/trips' });
    expect(container.querySelectorAll('a.tp-global-bottom-nav-btn').length).toBe(4);
  });

  it('在 /map「地圖」 tab is-active', () => {
    renderNav({ authed: true, pathname: '/map' });
    expect(screen.getByTestId('global-bottom-nav-map').className).toContain('is-active');
  });

  it('在 /trip/okinawa/map「地圖」 tab 也 is-active (additionalActivePatterns)', () => {
    renderNav({ authed: true, pathname: '/trip/okinawa/map' });
    expect(screen.getByTestId('global-bottom-nav-map').className).toContain('is-active');
  });

  it('在 /manage/map-xxx「地圖」 tab 不誤觸 active', () => {
    renderNav({ authed: true, pathname: '/manage/map-xxx' });
    expect(screen.getByTestId('global-bottom-nav-map').className).not.toContain('is-active');
  });

  it('在 /trip/okinawa「行程」 tab is-active 而「地圖」 不 active', () => {
    renderNav({ authed: true, pathname: '/trip/okinawa' });
    expect(screen.getByTestId('global-bottom-nav-trips').className).toContain('is-active');
    expect(screen.getByTestId('global-bottom-nav-map').className).not.toContain('is-active');
  });

  it('在 /trip/okinawa/map「行程」 tab 不 active (避免兩 tab 同時亮)', () => {
    renderNav({ authed: true, pathname: '/trip/okinawa/map' });
    expect(screen.getByTestId('global-bottom-nav-trips').className).not.toContain('is-active');
  });

  it('在 /chat「聊天」 tab is-active', () => {
    renderNav({ authed: true, pathname: '/chat' });
    expect(screen.getByTestId('global-bottom-nav-chat').className).toContain('is-active');
  });

  it('在 /explore「收藏」 tab is-active', () => {
    renderNav({ authed: true, pathname: '/explore' });
    expect(screen.getByTestId('global-bottom-nav-favorites').className).toContain('is-active');
  });

  it('CSS 含 min-height 44px (觸控目標 a11y)', () => {
    const { container } = renderNav({ authed: true, pathname: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/min-height:\s*var\(--spacing-tap-min,\s*44px\)/);
  });

  it('CSS 含 grid 4 col（rev2 帳號移 header）', () => {
    const { container } = renderNav({ authed: true, pathname: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/grid-template-columns:\s*repeat\(4,\s*1fr\)/);
  });

  it('active state 含 2px top indicator (mockup 規格)', () => {
    const { container } = renderNav({ authed: true, pathname: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/\.tp-global-bottom-nav-btn\.is-active::before[^}]*background:\s*var\(--color-accent\)/);
  });
});
