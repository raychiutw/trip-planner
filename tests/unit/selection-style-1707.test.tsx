/**
 * #1707 選取樣式統一（owner 2026-11-14 簽核 #1703 變體 B）。
 * 四處選中（手機底部膠囊 / Day tab / 側欄主導覽 / 我的行程）：
 *   選中底 = --color-accent-bg 淡柔褐（不再實心 accent-fill + 白字）、
 *   選中前景 = --color-selected-fg（淺 #6F4C2C／深 #D0A576）、選中 icon 換實心、未選 icon 退 muted。
 * 聊天頁「聊天」為主（膠囊）；目前行程為次（無底、字重 700、左側 3px 柔褐短條）。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GlobalBottomNav from '../../src/components/shell/GlobalBottomNav';
import DesktopSidebar from '../../src/components/shell/DesktopSidebar';
import { PRIMARY_NAV_ITEMS } from '../../src/components/shell/navItems';

const tokensRaw = readFileSync(path.resolve(__dirname, '../../css/tokens.css'), 'utf8');
const tokens = tokensRaw.replace(/\/\*[\s\S]*?\*\//g, '');
const iconSrc = readFileSync(path.resolve(__dirname, '../../src/components/shared/Icon.tsx'), 'utf8');

const rule = (css: string, sel: string) =>
  css.replace(/\/\*[\s\S]*?\*\//g, '').match(new RegExp(`${sel.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

function lum(hex: string) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
const tokenIn = (block: string, name: string) => block.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? '';

const lightBlock = tokens.slice(tokens.indexOf('@theme'), tokens.indexOf('@layer base'));
const darkStart = tokens.indexOf('body.dark {', tokens.indexOf('@layer base'));
const darkBlock = tokens.slice(darkStart, darkStart + 6000);

describe('選中前景 token 對比（WCAG 2.2 AA 4.5:1，11px label）', () => {
  it('淺色 --color-selected-fg = #6F4C2C，對 accent-bg／頁面底／secondary ≥ 4.5', () => {
    const fg = tokenIn(lightBlock, '--color-selected-fg');
    expect(fg.toUpperCase()).toBe('#6F4C2C');
    for (const bg of ['--color-accent-bg', '--color-background', '--color-secondary']) {
      expect(contrast(fg, tokenIn(lightBlock, bg)), bg).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('深色 --color-selected-fg 對深色 accent-bg／頁面底 ≥ 4.5', () => {
    const fg = tokenIn(darkBlock, '--color-selected-fg');
    expect(fg).not.toBe('');
    for (const bg of ['--color-accent-bg', '--color-background']) {
      expect(contrast(fg, tokenIn(darkBlock, bg)), bg).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('實心 icon（選中不只靠顏色）', () => {
  it('四個 root tab 都有 iconActive，且 Icon 登錄了該實心版本', () => {
    for (const item of PRIMARY_NAV_ITEMS) {
      expect(item.iconActive, item.key).toBeTruthy();
      expect(iconSrc, item.iconActive).toContain(`'${item.iconActive}':`);
    }
  });
  it('底部膠囊：選中 tab 渲染實心 icon、未選渲染外框', () => {
    const { getByTestId } = render(<MemoryRouter initialEntries={['/map']}><GlobalBottomNav authed /></MemoryRouter>);
    expect(getByTestId('global-bottom-nav-map').querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('nav-map-fill');
    expect(getByTestId('global-bottom-nav-chat').querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('nav-chat');
  });
  it('側欄：選中 tab 渲染實心 icon', () => {
    const { getByTestId } = render(<MemoryRouter initialEntries={['/chat']}><DesktopSidebar user={null} trips={[]} /></MemoryRouter>);
    expect(getByTestId('sidebar-nav-chat').querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('nav-chat-fill');
    expect(getByTestId('sidebar-nav-trips').querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('nav-suitcase');
  });
});

describe('選中底 = accent-bg + selected-fg（不再實心 accent-fill）', () => {
  const nav = render(<MemoryRouter><GlobalBottomNav authed /></MemoryRouter>).container.querySelector('style')?.textContent ?? '';
  const side = render(<MemoryRouter><DesktopSidebar user={null} trips={[]} /></MemoryRouter>).container.querySelector('style')?.textContent ?? '';
  const sel = (r: string) => {
    expect(r).toMatch(/background:\s*var\(--color-accent-bg\)/);
    expect(r).toMatch(/color:\s*var\(--color-selected-fg\)/);
    expect(r).not.toMatch(/accent-fill|accent-foreground/);
  };
  it('手機底部膠囊', () => sel(rule(nav, '.tp-global-bottom-nav-btn.is-active')));
  it('Day tab', () => sel(rule(tokens, '.tp-map-day-tab.is-active')));
  it('側欄主導覽', () => sel(rule(side, '.tp-sidebar-nav-item.is-active')));
  it('未選 icon 退 muted；選中 icon 用 selected-fg', () => {
    expect(rule(side, '.tp-sidebar-nav-item .svg-icon')).toMatch(/color:\s*var\(--color-muted\)/);
    expect(rule(side, '.tp-sidebar-nav-item.is-active .svg-icon')).toMatch(/color:\s*var\(--color-selected-fg\)/);
  });
});

describe('我的行程：目前行程為次（無底、700、左側 3px 柔褐短條）', () => {
  const side = render(<MemoryRouter><DesktopSidebar user={null} trips={[]} /></MemoryRouter>).container.querySelector('style')?.textContent ?? '';
  const r = rule(side, '.tp-trip-item.is-active');
  it('無底色', () => expect(r).not.toMatch(/background:\s*var\(--color-accent-bg\)/));
  it('字重 700、前景 foreground', () => {
    expect(r).toMatch(/font-weight:\s*700/);
    expect(r).toMatch(/color:\s*var\(--color-foreground\)/);
  });
  it('左側 3px 柔褐短條', () => expect(side).toMatch(/\.tp-trip-item\.is-active::before\s*\{[^}]*width:\s*3px[^}]*background:\s*var\(--color-accent\)/));
});
