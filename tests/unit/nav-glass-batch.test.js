/**
 * owner 2026-07-21 第二批 UI 修正
 *
 * 1. TripsListPage 的切換行程仍是舊的 `⇄ ▾` icon —— 上一批只換了 ChatPage /
 *    MapPage，這頁漏了，而它正是 owner 截圖裡看到的那頁。
 * 2. header（TitleBar）與 day tab 要與底部 tab 同一套 liquid glass。
 *    先前三者各用各的材質：TitleBar 走 `--color-glass-nav`（92% 奶油，
 *    近乎不透明）、day tab 走 `--blur-glass`(14px)、底部 tab 才是新的
 *    `--tabbar-*`。同一個畫面三種玻璃，看起來就不像同一個系統。
 * 3. 手機右上角帳號圓圈移除後，底部 tab 沒補上第五個入口 —— 帳號變成無處可去。
 * 4. 下捲不得隱藏底部 tab。owner 在 2026-07-20 就要求過「保持常駐」，
 *    AppShell 的 scroll-hide 卻還在。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel) => readFileSync(join(__dirname, '../..', rel), 'utf8');
const TOKENS = read('css/tokens.css');
const SHELL = read('src/components/shell/AppShell.tsx');
const NAV_ITEMS = read('src/components/shell/navItems.ts');

describe('① TripsListPage 切換行程改為標題+chevron', () => {
  const SRC = read('src/pages/TripsListPage.tsx');

  it('不再有 swap-horiz 圖示按鈕', () => {
    expect(SRC, 'owner 要求移除切換行程 icon').not.toMatch(/swap-horiz/);
  });

  it('改用共用的 TripTitleSwitcher', () => {
    expect(SRC).toMatch(/<TripTitleSwitcher/);
  });
});

describe('② header 與 day tab 用同一套 liquid glass', () => {
  /** 取某個 selector 的宣告區塊（到第一個 `}` 為止）。 */
  const block = (selector) => {
    const i = TOKENS.indexOf(selector);
    if (i < 0) return '';
    return TOKENS.slice(i, TOKENS.indexOf('\n}', i));
  };

  it('TitleBar 走 --tabbar-* 材質', () => {
    // .tp-titlebar 有兩份（≥761 / <761 兩個 media block），兩份都要。
    const count = (TOKENS.match(/backdrop-filter:\s*var\(--tabbar-filter\)/g) ?? []).length;
    expect(count, 'header 兩份 media block + day tab + 底部 tab 都要用同一材質')
      .toBeGreaterThanOrEqual(3);
    // 舊材質：奶油底疊奶油頁 + blur 只有底部 tab 一半。
    expect(TOKENS.slice(TOKENS.indexOf('  .tp-titlebar {')))
      .not.toMatch(/background:\s*color-mix\(in srgb, var\(--color-background\) 80%/);
  });

  it('day tab 走同一套材質', () => {
    const b = block('.tp-map-day-tabs {');
    expect(b, '找不到 day tab 樣式').toBeTruthy();
    expect(b).toMatch(/var\(--tabbar-filter\)/);
    expect(b, '不該還用 secondary 88%').not.toMatch(/--color-secondary\) 88%/);
  });
});

describe('③ 底部 tab 補第五個「帳號」', () => {
  it('navItems 含 account', () => {
    expect(NAV_ITEMS, '手機右上角帳號移除後，帳號需要一個入口').toMatch(/key:\s*'account'/);
    expect(NAV_ITEMS).toMatch(/href:\s*'\/account'/);
  });

  it('key 型別聯集也要加上 account', () => {
    expect(NAV_ITEMS).toMatch(/'chat'\s*\|[\s\S]{0,80}'account'/);
  });
});

describe('④ 下捲不得隱藏底部 tab', () => {
  it('AppShell 不再有 scroll-hide 狀態', () => {
    // owner 2026-07-20 已要求「保持常駐，滾動不隱藏」。
    // 只看程式碼，不看註解 —— 註解刻意留下「為什麼移除」的紀錄。
    const code = SHELL.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code, 'navHidden 狀態應整個移除').not.toMatch(/navHidden/);
    expect(code).not.toMatch(/addEventListener\('scroll'/);
  });

  it('沒有把膠囊移出畫面的 transform', () => {
    const code = SHELL.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/translateY\(180%\)/);
    expect(code).not.toMatch(/data-hidden/);
  });
});
