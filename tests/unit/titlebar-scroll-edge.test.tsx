/**
 * TitleBar — HIG scroll edge effect
 *
 * HIG：捲到頂時 header 沒有材質、沒有分隔線（標題直接坐在內容上）；一旦內容開始
 * 從 header 下方流過，材質與 hairline 才淡入。「材質在需要它的時候才出現」。
 *
 * 現況是**恆常**半透明 + border，在捲到頂時那條線沒有任何作用，只是一條灰糊邊。
 *
 * SoT：docs/design-sessions/2026-07-20-chrome-hig-regular-glass.html §Section 3
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import TitleBar from '../../src/components/shell/TitleBar';

const ROOT = resolve(__dirname, '../../');
const tokens = readFileSync(resolve(ROOT, 'css/tokens.css'), 'utf-8');

/** 剝掉註解 —— 解釋「為何移除 X」的散文不該讓「不得出現 X」的斷言變紅。 */
const decls = tokens.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * 取出某 @media block 內、某 selector 的 rule body。
 *
 * `@media (max-width: 760px)` 在本檔出現多次（type scale、print、titlebar…），
 * 所以要掃過**所有**出現位置，取第一個真的含該 selector 的 block —— 抓第一個
 * 會拿到 type scale 那塊、回傳空字串，讓測試以「找不到」的假象變紅。
 */
function ruleIn(mediaQuery: string, selector: string): string {
  const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`);
  let from = 0;
  for (;;) {
    const mediaIdx = decls.indexOf(mediaQuery, from);
    if (mediaIdx === -1) return '';
    const nextMedia = decls.indexOf('\n@media', mediaIdx + 1);
    const scope = decls.slice(mediaIdx, nextMedia === -1 ? undefined : nextMedia);
    const hit = scope.match(re)?.[1];
    if (hit !== undefined) return hit;
    from = mediaIdx + 1;
  }
}

const BREAKPOINTS = [
  ['desktop', '@media (min-width: 761px)'],
  ['compact', '@media (max-width: 760px)'],
] as const;

describe('TitleBar CSS — 捲到頂為無材質態', () => {
  // 兩份 .tp-titlebar 定義（761 / 760）是複製貼上關係，最容易只改一半 →
  // compact 斷點靜默留著舊材質。兩份都斷言。
  it.each(BREAKPOINTS)('%s：預設 background 透明，不帶玻璃', (_label, mq) => {
    const rule = ruleIn(mq, '.tp-titlebar');
    expect(rule).toMatch(/background:\s*transparent/);
    expect(rule).not.toMatch(/backdrop-filter/);
  });

  it.each(BREAKPOINTS)('%s：預設 border-bottom 保留 1px 但設 transparent（避免捲動時跳 1px）', (_label, mq) => {
    const rule = ruleIn(mq, '.tp-titlebar');
    expect(rule).toMatch(/border-bottom:\s*1px solid transparent/);
  });

  it.each(BREAKPOINTS)('%s：transition 只動 background / border-color', (_label, mq) => {
    const rule = ruleIn(mq, '.tp-titlebar');
    expect(rule).toMatch(/transition:[^;]*background/);
    expect(rule).toMatch(/transition:[^;]*border-color/);
    // backdrop-filter 的 transition 在多數瀏覽器是逐 frame 重算整塊模糊，會 jank。
    expect(rule).not.toMatch(/transition:[^;]*backdrop-filter/);
  });
});

describe('TitleBar CSS — 捲動後材質態', () => {
  it.each(BREAKPOINTS)('%s：.is-scrolled 掛上 Regular Glass + hairline', (_label, mq) => {
    const rule = ruleIn(mq, '.tp-titlebar.is-scrolled');
    expect(rule).toMatch(/background:\s*var\(--glass-tint\)/);
    expect(rule).toMatch(/backdrop-filter:\s*var\(--glass-filter\)/);
    expect(rule).toMatch(/box-shadow:\s*var\(--glass-specular\)/);
    expect(rule).toMatch(/border-bottom-color:\s*var\(--color-border\)/);
  });
});

describe('TitleBar — scroll container 綁定', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  /**
   * 真正的 scroll container 是 .app-shell-main / .app-shell-sheet（overflow-y:auto），
   * document 因為 .app-shell{height:100dvh} **永不捲動**。綁 window 會變成全站死碼，
   * 而且不會有任何測試抓到 —— 它只是「永遠停在透明態」，看起來像設計。
   */
  function renderInScroller(props: Parameters<typeof TitleBar>[0] = { title: 'T' }) {
    const scroller = document.createElement('div');
    scroller.style.overflowY = 'auto';
    document.body.appendChild(scroller);
    const result = render(<TitleBar {...props} />, { container: scroller });
    return { scroller, ...result };
  }

  it('捲到頂時不掛 is-scrolled', () => {
    const { scroller } = renderInScroller();
    const bar = scroller.querySelector('.tp-titlebar');
    expect(bar?.className).not.toContain('is-scrolled');
  });

  it('scroll container 捲動後掛上 is-scrolled', () => {
    const { scroller } = renderInScroller();
    Object.defineProperty(scroller, 'scrollTop', { value: 120, writable: true, configurable: true });
    act(() => { scroller.dispatchEvent(new Event('scroll')); });
    expect(scroller.querySelector('.tp-titlebar')?.className).toContain('is-scrolled');
  });

  it('捲回頂端後移除 is-scrolled', () => {
    const { scroller } = renderInScroller();
    Object.defineProperty(scroller, 'scrollTop', { value: 120, writable: true, configurable: true });
    act(() => { scroller.dispatchEvent(new Event('scroll')); });
    Object.defineProperty(scroller, 'scrollTop', { value: 0, writable: true, configurable: true });
    act(() => { scroller.dispatchEvent(new Event('scroll')); });
    expect(scroller.querySelector('.tp-titlebar')?.className).not.toContain('is-scrolled');
  });

  it('alwaysSolid：無捲動容器的頁面（MapPage）恆為材質態', () => {
    // .map-page-wrap { overflow: hidden } 永不捲動 → 沒有 opt-out 的話 TitleBar 會
    // 永遠停在透明態，標題直接壓在地圖圖磚上（衛星影像時完全不可讀）。
    const { scroller } = renderInScroller({ title: 'T', alwaysSolid: true });
    expect(scroller.querySelector('.tp-titlebar')?.className).toContain('is-scrolled');
  });
});
