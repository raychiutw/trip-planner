/**
 * `.tp-map-day-tabs` 水平 scroll regression.
 *
 * Bug context：7-day trip 在 mobile viewport (≤390px) day 6/7 chips 超出
 * viewport；tab strip 需要可水平 scroll。
 *
 * Current contract：保留 overflow-x scrolling，但不要用 mask-image fade。
 * 右緣 mask 會讓最後一個 active tab 被漸層切掉，像 UI 污點。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const TOKENS_CSS = readFileSync(
  path.resolve(__dirname, '../../css/tokens.css'),
  'utf8',
);

describe('tokens.css — .tp-map-day-tabs horizontal scroll', () => {
  it('不使用 mask-image fade，避免 active tab 右緣被漸層切掉', () => {
    const dayTabsRule = TOKENS_CSS.match(/\.tp-map-day-tabs\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(dayTabsRule).not.toMatch(/mask-image\s*:/);
    expect(dayTabsRule).not.toMatch(/-webkit-mask-image\s*:/);
  });

  it('overflow-x: auto + scrollbar-width: none 保留', () => {
    expect(TOKENS_CSS).toMatch(/\.tp-map-day-tabs\s*\{[\s\S]{0,400}overflow-x:\s*auto/);
    expect(TOKENS_CSS).toMatch(/\.tp-map-day-tabs\s*\{[\s\S]{0,400}scrollbar-width:\s*none/);
  });
});

describe('tokens.css — Day tab 比照 root tab（#1140 item 3/4）', () => {
  it('item 3：active 用實心 --color-accent-fill（比照 root tab），非 14% 淡 tonal', () => {
    const activeRule = TOKENS_CSS.match(/\.tp-map-day-tab\.is-active\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(activeRule).toMatch(/background:\s*var\(--color-accent-fill\)/);
    expect(activeRule).toMatch(/color:\s*var\(--color-accent-foreground\)/);
    // 舊的淡 tonal（14% day-color tint）不應再存在
    expect(activeRule).not.toMatch(/14%/);
  });

  it('item 4：桌機（≥1024）Day tab 固定寬 + 置中，容器保留原生水平捲動（無箭頭）', () => {
    // desktop media query 內把 .tp-map-day-tab 設固定寬
    expect(TOKENS_CSS).toMatch(
      /@media\s*\(min-width:\s*1024px\)\s*\{[\s\S]*?\.tp-map-day-tab\s*\{[\s\S]{0,120}flex:\s*0\s*0\s*88px/,
    );
  });
});
