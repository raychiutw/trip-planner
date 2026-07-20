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

  it('tab 高 ≥44px 觸控目標（min-height 46px = mockup .ph-tab）', () => {
    const { container } = renderNav({ authed: true, pathname: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/min-height:\s*46px/);
  });

  it('Regular Glass 浮動膠囊（非滿版 grid bar、非品牌 color-mix、非全透明）', () => {
    const { container } = renderNav({ authed: true, pathname: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    // 歷史：owner 2026-07-20「不要白底」→ 當時把材質**整個刪掉**（transparent + icon 黑
    // drop-shadow）。但根因不是「有底」，是底被**品牌奶油色**染色（HIG 明令 glass 不上
    // tint）——奶油玻璃疊奶油頁必糊。改中性 tint 後材質回歸，膠囊重新成為一個容器。
    const navBlock = style.match(/\.tp-global-bottom-nav\s*\{[^}]*\}/)?.[0] ?? '';
    expect(navBlock).toMatch(/background:\s*var\(--glass-tint\)/);
    expect(navBlock).toMatch(/backdrop-filter:\s*var\(--glass-filter\)/);
    expect(navBlock).toMatch(/border:\s*var\(--glass-rim\)/);
    expect(navBlock).toMatch(/box-shadow:\s*var\(--glass-specular\),\s*var\(--glass-shadow\)/);
    expect(navBlock).not.toMatch(/color-mix/); // 不得回頭用品牌染色
    expect(style).not.toMatch(/grid-template-columns/); // 仍是 flex 膠囊，非滿版 grid bar
  });

  it('有容器後不再給 icon / label 補陰影（那是缺容器的代償）', () => {
    const { container } = renderNav({ authed: true, pathname: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    // 黑 drop-shadow 疊在 frosted 板上會讀成髒污，且它原本只是為了讓 icon 在
    // 透明態的地圖雜底上浮出來。容器回來了，代償就該撤掉。
    expect(style).not.toMatch(/drop-shadow/);
    expect(style).not.toMatch(/text-shadow/);
  });

  it('label 用 caption2(11px) — HIG tab label 字級，非 eyebrow(10px)', () => {
    const { container } = renderNav({ authed: true, pathname: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    // DESIGN.md L58 早就寫 bottom-nav-label 11px/700，是 code 漂移成 eyebrow(10px)。
    expect(style).toMatch(/font-size:\s*var\(--font-size-caption2\)/);
    expect(style).not.toMatch(/var\(--font-size-eyebrow\)/);
    expect(style).toMatch(/line-height:\s*13px/);
  });

  it('inactive label 用 foreground 而非 muted（satellite 圖磚上的對比度下限）', () => {
    const { container } = renderNav({ authed: true, pathname: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    // 膠囊可能浮在 satellite/hybrid 圖磚上（MapFabs MapTileStyle）。合成底 #A8A8A8 配
    // --color-muted 只有 2.76:1（11px bold 不算 WCAG large text，門檻 4.5 非 3.0）；
    // 改 --color-foreground 得 6.39:1。active/inactive 靠 accent 實心藥丸區分，不靠灰階。
    const btnBlock = style.match(/\.tp-global-bottom-nav-btn\s*\{[^}]*\}/)?.[0] ?? '';
    expect(btnBlock).toMatch(/color:\s*var\(--color-foreground\)/);
    expect(btnBlock).not.toMatch(/color:\s*var\(--color-muted\)/);
  });

  it('容器不再需要 pointer-events 逃生艙（透明態才需要讓點擊穿透）', () => {
    const { container } = renderNav({ authed: true, pathname: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).not.toMatch(/pointer-events/);
  });

  it('active state = accent 實心 pill（非 2px top indicator）', () => {
    const { container } = renderNav({ authed: true, pathname: '/trips' });
    const style = container.querySelector('style')?.textContent ?? '';
    expect(style).toMatch(/\.tp-global-bottom-nav-btn\.is-active\s*\{[^}]*background:\s*var\(--color-accent-fill\)/);
    expect(style).not.toMatch(/is-active::before/);
  });
});
