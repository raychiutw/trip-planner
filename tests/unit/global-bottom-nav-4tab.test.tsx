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

describe('GlobalBottomNav — 5-tab IA（2026-07-21 帳號回到底部）', () => {
  it('logged-in render 5 tabs：聊天 / 行程 / 地圖 / 收藏 / 帳號', () => {
    renderNav({ authed: true, pathname: '/trips' });
    expect(screen.getByTestId('global-bottom-nav-chat')).toBeTruthy();
    expect(screen.getByTestId('global-bottom-nav-trips')).toBeTruthy();
    expect(screen.getByTestId('global-bottom-nav-map')).toBeTruthy();
    expect(screen.getByTestId('global-bottom-nav-favorites')).toBeTruthy();
    // 帳號/登入 移出 tab slot → header 帳號圓圈
    // 2026-07-21：帳號回到底部 tab（owner：手機右上角帳號移除後沒有入口）。
    expect(screen.getByTestId('global-bottom-nav-account')).toBeTruthy();
    expect(screen.queryByTestId('global-bottom-nav-login')).toBeNull();
  });

  it('logged-out 也 5 tab', () => {
    renderNav({ authed: false, pathname: '/trips' });
    expect(screen.getByTestId('global-bottom-nav-chat')).toBeTruthy();
    expect(screen.getByTestId('global-bottom-nav-favorites')).toBeTruthy();
    expect(screen.queryByTestId('global-bottom-nav-login')).toBeNull();
    // 2026-07-21：帳號回到底部 tab（owner：手機右上角帳號移除後沒有入口）。
    expect(screen.getByTestId('global-bottom-nav-account')).toBeTruthy();
  });

  it('nav render 5 個連結', () => {
    const { container } = renderNav({ authed: true, pathname: '/trips' });
    expect(container.querySelectorAll('a.tp-global-bottom-nav-btn').length).toBe(5);
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

  it('tab 高 ≥44px 觸控目標（min-height 46px = mockup .ph-tab）', () => {
    const { container } = renderNav({ authed: true, pathname: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/min-height:\s*46px/);
  });

  it('玻璃膠囊 flex 列（非滿版 grid bar；材質參數見 tabbar-glass-material.test.js）', () => {
    const { container } = renderNav({ authed: true, pathname: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    // 2026-07-21 翻轉：本條原本鎖 `background: transparent`，那是 owner 7/20
    // 「不要白底」的解法。7/21 owner 反映「沒有玻璃化效果，變成全透明」——
    // 全透明解決了白條，卻連材質也一起沒了。現在走低 tint + 強模糊 + 高飽和度，
    // 底下內容透得出來才讀作玻璃。tint 上限等參數由
    // tests/unit/tabbar-glass-material.test.js 鎖，這裡只確認「有材質」與版型。
    const navBlock = style.match(/\.tp-global-bottom-nav\s*\{[^}]*\}/)?.[0] ?? '';
    expect(navBlock, '容器不該再是全透明').not.toMatch(/background:\s*transparent/);
    expect(navBlock).toMatch(/backdrop-filter:\s*var\(--tabbar-filter\)/);
    // cream 疊 cream 正是最初「像實心白條」的成因 —— 中性 tint，不用 color-mix 取頁面底色。
    expect(navBlock, 'tint 不該取頁面底色（cream-on-cream）').not.toMatch(/color-mix/);
    // icon 陰影減弱但保留：地圖衛星圖這類雜底仍需要分離度。
    expect(style).toMatch(/\.tp-global-bottom-nav-btn\s+\.svg-icon\s*\{[^}]*drop-shadow/);
    expect(style, '仍是 flex 膠囊，非舊的 grid 滿版 bar').not.toMatch(/grid-template-columns/);
  });

  it('active state = accent 實心 pill（非 2px top indicator）', () => {
    const { container } = renderNav({ authed: true, pathname: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/\.tp-global-bottom-nav-btn\.is-active\s*\{[^}]*background:\s*var\(--color-accent-fill\)/);
    expect(style).not.toMatch(/is-active::before/);
  });
});
