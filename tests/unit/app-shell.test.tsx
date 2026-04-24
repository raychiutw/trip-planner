/**
 * AppShell — B-P2 §2 layout primitive
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
  it('§2.1 桌機 3-pane：傳 sheet prop 時 data-layout="3pane" + sheet slot 存在', () => {
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

  it('§2.2 桌機 2-pane：不傳 sheet prop 時 data-layout="2pane" + sheet slot 不存在', () => {
    const { getByTestId, queryByTestId } = render(
      <AppShell sidebar={<div>SIDE</div>} main={<div>MAIN</div>} />,
    );
    expect(getByTestId('app-shell').getAttribute('data-layout')).toBe('2pane');
    expect(queryByTestId('app-shell-sheet')).toBeNull();
  });

  it('§2.3 4 個 slot 都 render 在 DOM 中（手機 hide via CSS，非 unmount）', () => {
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

  it('§2.3 沒傳 bottomNav 時不 render bottom nav 元素', () => {
    const { queryByTestId } = render(
      <AppShell sidebar={<div>SIDE</div>} main={<div>MAIN</div>} />,
    );
    expect(queryByTestId('app-shell-bottom-nav')).toBeNull();
  });
});

describe('AppShell — CSS rules（驗 SCOPED_STYLES，jsdom 不套 media query）', () => {
  it('§2.1 desktop 3-pane 用 var(--grid-3pane-desktop)', () => {
    expect(APP_SHELL_STYLES).toMatch(
      /\[data-layout="3pane"\][\s\S]*?grid-template-columns:\s*var\(--grid-3pane-desktop\)/,
    );
  });

  it('§2.2 desktop 2-pane 用 var(--grid-2pane-desktop)', () => {
    expect(APP_SHELL_STYLES).toMatch(
      /\[data-layout="2pane"\][\s\S]*?grid-template-columns:\s*var\(--grid-2pane-desktop\)/,
    );
  });

  it('§2.3 mobile breakpoint <1024px 隱藏 sidebar', () => {
    // 找 max-width: 1023px 內的 sidebar display: none
    expect(APP_SHELL_STYLES).toMatch(
      /@media[^{]*max-width:\s*1023px[\s\S]*?\.app-shell-sidebar[\s\S]*?display:\s*none/,
    );
  });

  it('§2.3 mobile breakpoint <1024px 隱藏 sheet', () => {
    expect(APP_SHELL_STYLES).toMatch(
      /@media[^{]*max-width:\s*1023px[\s\S]*?\.app-shell-sheet[\s\S]*?display:\s*none/,
    );
  });

  it('§2.4 mobile main 有 padding-bottom: var(--nav-height-mobile)', () => {
    expect(APP_SHELL_STYLES).toMatch(
      /@media[^{]*max-width:\s*1023px[\s\S]*?\.app-shell-main[\s\S]*?padding-bottom:\s*var\(--nav-height-mobile\)/,
    );
  });

  it('§2.3 desktop breakpoint ≥1024px 顯示 3-pane / 2-pane grid', () => {
    expect(APP_SHELL_STYLES).toMatch(/@media[^{]*min-width:\s*1024px/);
  });
});
