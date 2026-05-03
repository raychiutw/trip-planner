/**
 * GlobalBottomNav 5-tab unit test — Section 5 (terracotta-mockup-parity-v2 / E4)
 *
 * 驗 mockup section 02 對齊：
 *   - logged-in 5 tab (v2.21.0)：聊天 / 行程 / 地圖 / 收藏 / 帳號
 *   - logged-out 5 tab (v2.21.0)：聊天 / 行程 / 地圖 / 收藏 / 登入
 *   - 帳號 entry → /account
 *   - 「地圖」 active 對 /map + /trip/:id/map (但不對 /manage/map-xxx)
 *   - 「行程」 active 對 /trips + /trip/:id (但不對 /trip/:id/map)
 *   - 觸控目標 ≥44px (min-height CSS)
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

describe('GlobalBottomNav — 5-tab IA', () => {
  it('logged-in render 5 tabs：聊天 / 行程 / 地圖 / 收藏 / 帳號 (v2.21.0)', () => {
    renderNav({ authed: true, pathname: '/trips' });
    expect(screen.getByTestId('global-bottom-nav-chat')).toBeTruthy();
    expect(screen.getByTestId('global-bottom-nav-trips')).toBeTruthy();
    expect(screen.getByTestId('global-bottom-nav-map')).toBeTruthy();
    expect(screen.getByTestId('global-bottom-nav-saved')).toBeTruthy();
    expect(screen.getByTestId('global-bottom-nav-account')).toBeTruthy();
    expect(screen.queryByTestId('global-bottom-nav-login')).toBeNull();
  });

  it('logged-out 5 tab 末位是「登入」 (替換「帳號」)', () => {
    renderNav({ authed: false, pathname: '/trips' });
    expect(screen.getByTestId('global-bottom-nav-login')).toBeTruthy();
    expect(screen.queryByTestId('global-bottom-nav-account')).toBeNull();
  });

  it('「帳號」 entry href 指向 /account (不是 /settings/sessions)', () => {
    renderNav({ authed: true, pathname: '/account' });
    const account = screen.getByTestId('global-bottom-nav-account') as HTMLAnchorElement;
    expect(account.getAttribute('href')).toBe('/account');
  });

  it('在 /account 路徑時「帳號」 tab is-active', () => {
    renderNav({ authed: true, pathname: '/account' });
    expect(screen.getByTestId('global-bottom-nav-account').className).toContain('is-active');
  });

  it('在 /settings/sessions「帳號」也算 active (matchPrefixes 涵蓋 /settings)', () => {
    renderNav({ authed: true, pathname: '/settings/sessions' });
    expect(screen.getByTestId('global-bottom-nav-account').className).toContain('is-active');
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

  it('在 /explore「探索」 tab is-active', () => {
    renderNav({ authed: true, pathname: '/explore' });
    expect(screen.getByTestId('global-bottom-nav-saved').className).toContain('is-active');
  });

  it('CSS 含 min-height 44px (觸控目標 a11y)', () => {
    const { container } = renderNav({ authed: true, pathname: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/min-height:\s*var\(--spacing-tap-min,\s*44px\)/);
  });

  it('CSS 含 grid 5 col (mockup section 02)', () => {
    const { container } = renderNav({ authed: true, pathname: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/grid-template-columns:\s*repeat\(5,\s*1fr\)/);
  });

  it('active state 含 2px top indicator (mockup 規格)', () => {
    const { container } = renderNav({ authed: true, pathname: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/\.tp-global-bottom-nav-btn\.is-active::before[^}]*background:\s*var\(--color-accent\)/);
  });
});
