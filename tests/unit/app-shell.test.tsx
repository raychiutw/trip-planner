/**
 * AppShell 
 *
 * 桌機 3-pane (sidebar + main + sheet) / 2-pane (sidebar + main, no sheet)
 * 手機單欄 + bottom nav，sidebar / sheet 由 CSS media query 隱藏（DOM 仍存在）
 *
 * 視覺對應：docs/design-sessions/mockup-trip-v2.html
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AppShell, { APP_SHELL_STYLES } from '../../src/components/shell/AppShell';

describe('AppShell — render slots + data-layout', () => {
  it('桌機 3-pane：傳 sheet prop 時 data-layout="3pane" + sheet slot 存在', () => {
    const { getByTestId } = render(
      <AppShell
        sidebar={<div>SIDE</div>}
        main={<div>MAIN</div>}
        sheet={<div>SHEET</div>}
      />,
    );
    expect(getByTestId('app-shell').getAttribute('data-layout')).toBe('3pane');
    expect(getByTestId('app-shell-sheet').textContent).toBe('SHEET');
  });

  it('桌機 2-pane：不傳 sheet prop 時 data-layout="2pane" + sheet slot 不存在', () => {
    const { getByTestId, queryByTestId } = render(
      <AppShell sidebar={<div>SIDE</div>} main={<div>MAIN</div>} />,
    );
    expect(getByTestId('app-shell').getAttribute('data-layout')).toBe('2pane');
    expect(queryByTestId('app-shell-sheet')).toBeNull();
  });

  it('4 個 slot 都 render 在 DOM 中（手機 hide via CSS，非 unmount）', () => {
    const { getByTestId } = render(
      <AppShell
        sidebar={<div>SIDE</div>}
        main={<div>MAIN</div>}
        sheet={<div>SHEET</div>}
        bottomNav={<div>NAV</div>}
      />,
    );
    expect(getByTestId('app-shell-sidebar').textContent).toBe('SIDE');
    expect(getByTestId('app-shell-main').textContent).toBe('MAIN');
    expect(getByTestId('app-shell-sheet').textContent).toBe('SHEET');
    expect(getByTestId('app-shell-bottom-nav').textContent).toBe('NAV');
  });

  it('沒傳 bottomNav 時不 render bottom nav 元素', () => {
    const { queryByTestId } = render(
      <AppShell sidebar={<div>SIDE</div>} main={<div>MAIN</div>} />,
    );
    expect(queryByTestId('app-shell-bottom-nav')).toBeNull();
  });
});

describe('AppShell — CSS rules（驗 SCOPED_STYLES，jsdom 不套 media query）', () => {
  it('desktop 3-pane 用 var(--grid-3pane-desktop)', () => {
    expect(APP_SHELL_STYLES).toMatch(
      /\[data-layout="3pane"\][\s\S]*?grid-template-columns:\s*var\(--grid-3pane-desktop\)/,
    );
  });

  it('desktop 2-pane 用 var(--grid-2pane-desktop)', () => {
    expect(APP_SHELL_STYLES).toMatch(
      /\[data-layout="2pane"\][\s\S]*?grid-template-columns:\s*var\(--grid-2pane-desktop\)/,
    );
  });

  it('mobile breakpoint <1024px 隱藏 sidebar', () => {
    // 找 max-width: 1023px 內的 sidebar display: none
    expect(APP_SHELL_STYLES).toMatch(
      /@media[^{]*max-width:\s*1023px[\s\S]*?\.app-shell-sidebar[\s\S]*?display:\s*none/,
    );
  });

  it('mobile breakpoint <1024px 隱藏 sheet', () => {
    expect(APP_SHELL_STYLES).toMatch(
      /@media[^{]*max-width:\s*1023px[\s\S]*?\.app-shell-sheet[\s\S]*?display:\s*none/,
    );
  });

  it('app-shell sets explicit grid height so each column is a real scroll container', () => {
    // .app-shell needs height: 100dvh (not just min-height) for sidebar /
    // main / sheet to be constrained and scrollable independently. Without
    // it, the grid grows with content and one column scrolling drags the
    // others (or the document) along. Required on BOTH mobile and desktop
    // (was previously mobile-only — caused desktop sheet/main coupling).
    expect(APP_SHELL_STYLES).toMatch(
      /\.app-shell\s*\{[^}]*?height:\s*100dvh/,
    );
  });

  it('desktop breakpoint ≥1024px 顯示 3-pane / 2-pane grid', () => {
    expect(APP_SHELL_STYLES).toMatch(/@media[^{]*min-width:\s*1024px/);
  });
});

/**
 * Regular Glass 收斂（2026-07-20）：膠囊改常駐 + 材質回歸後，定位與讓位高度
 * 都必須由 --chrome-inset 派生，不能再散落硬寫值。
 * SoT：docs/design-sessions/2026-07-20-chrome-hig-regular-glass.html
 */
/**
 * 「不得出現 X」類斷言必須先剝掉註解 —— 否則解釋「為什麼移除 X」的註解本身會讓
 * 測試變紅，逼人寫出無法解釋自己的程式碼。斷言的意圖是宣告，不是散文。
 */
function declarationsOnly(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}
const SHELL_DECLS = declarationsOnly(APP_SHELL_STYLES);

describe('AppShell — 浮動膠囊定位（--chrome-inset 單一來源）', () => {
  it('膠囊 bottom 吃 --chrome-inset，不硬寫 12px', () => {
    expect(SHELL_DECLS).toMatch(/bottom:\s*max\(\s*var\(--chrome-inset\)/);
    expect(SHELL_DECLS).not.toMatch(/bottom:\s*calc\(12px/);
  });

  it('safe-area 用 max() 而非 calc() 相加', () => {
    // HIG 的 21pt inset 語意是「離螢幕邊」，而 home indicator 的 34px 已經是那段距離
    // 的一部分，所以取較大值而非相加（calc(21+34)=55px 會浮太高）。
    // 相對舊值 calc(12px + env(...)) 的實際位移：iPhone 46→34、無 safe-area 12→21。
    expect(SHELL_DECLS).toMatch(
      /bottom:\s*max\(\s*var\(--chrome-inset\),\s*env\(safe-area-inset-bottom[^)]*\)\s*\)/,
    );
  });

  it('--nav-overlay-h 由膠囊實高派生，且 mirror bottom 的 max()', () => {
    // 膠囊實高 60px = padding 6*2 + btn min-height 46 + border 1*2。
    // border 那 2px 不能省：`* { box-sizing: border-box }` 只作用於有明確 width/height
    // 的元素，膠囊是 height:auto → padding 與 border 一定外加。
    //
    // 必須 mirror bottom 的 max()。只寫 calc(var(--chrome-inset) + 60px) 的話，
    // iPhone（safe-area 34）上膠囊實佔 34+60=94 卻只保留 81 → 短少 13px，
    // ChatPage composer 上緣會被膠囊壓住。
    expect(SHELL_DECLS).toMatch(
      /--nav-overlay-h:\s*calc\(\s*max\(\s*var\(--chrome-inset\),\s*env\(safe-area-inset-bottom[^)]*\)\s*\)\s*\+\s*60px\s*\)/,
    );
    expect(SHELL_DECLS).not.toMatch(/--nav-height-mobile/);
  });
});

describe('AppShell — 膠囊常駐（owner 2026-07-20 決定，不實作 HIG minimize）', () => {
  it('不再有捲動隱藏的 transform 規則', () => {
    expect(SHELL_DECLS).not.toMatch(/data-hidden/);
    expect(SHELL_DECLS).not.toMatch(/translateY\(180%\)/);
  });

  it('膠囊容器不再需要 pointer-events 逃生艙', () => {
    // 那是「膠囊全透明卻仍是 fixed overlay」時期的補丁：容器不吃事件、靠子按鈕補回。
    // 材質回歸後膠囊收縮成實際藥丸大小，兩邊一起移除。
    // 只查膠囊那條 rule —— .app-shell-ptr（PTR spinner）有自己合法的 pointer-events:none。
    const navRule = SHELL_DECLS.match(/\.app-shell-bottom-nav\s*\{[^}]*\}/)?.[0] ?? '';
    expect(navRule).not.toBe('');
    expect(navRule).not.toMatch(/pointer-events/);
  });
});
