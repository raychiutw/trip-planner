/**
 * W5（owner 2026-07-24：保留玻璃膠囊、只補 a11y）— G15 玻璃降級 + G16 底部列 offset。
 *
 * owner 選擇保留浮動玻璃膠囊（iOS 26 Liquid Glass，本身對齊新版 HIG），不動材質；
 * 只補兩個無爭議的收尾：
 *   G15：使用者開「降低透明度 / 提高對比」時，**全玻璃面**（不只 tab bar）都要降級 ——
 *        `--blur-glass:0` 關掉兩條走 --blur-glass 的模糊、glass tint 轉不透明、兩底部列
 *        的 color-mix 半透明底顯式蓋成全不透明。
 *   G16：桌機底部列 `left` 從 hardcoded 240px 改用 `--sidebar-width-desktop`（實際 216px），
 *        對齊 sidebar 右緣（原本差 24px 露出一條中欄）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync(join(__dirname, '../../css/tokens.css'), 'utf8');

/**
 * 抓某個 @media 條件的 block 內容，用括號配對抓到真正的收尾 `}`。
 *
 * ⚠ 原本是 `CSS.slice(idx, idx + 600)` —— 固定字元視窗。2026-07-26（#1176）往
 * `prefers-contrast` 區塊加了幾行語意色加強階 + 註解，`--blur-glass` 就被推出 600 字元外，
 * 這幾條斷言全紅。那不是回歸，是量尺太短。固定視窗只會造成假紅（斷言都是「必須存在」），
 * 但它會讓人以為改壞了東西 —— 所以改成真的讀完整個 block。
 */
function mediaBlock(condition: string): string {
  const idx = CSS.indexOf(`@media (${condition})`);
  if (idx < 0) return '';
  const open = CSS.indexOf('{', idx);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < CSS.length; i++) {
    if (CSS[i] === '{') depth++;
    else if (CSS[i] === '}' && --depth === 0) return CSS.slice(idx, i + 1);
  }
  return '';
}

describe('W5 G15 — 降低透明度 / 提高對比 全玻璃面降級', () => {
  for (const cond of ['prefers-reduced-transparency: reduce', 'prefers-contrast: more']) {
    it(`${cond}：--blur-glass:0 + 兩底部列全不透明`, () => {
      const block = mediaBlock(cond);
      expect(block, `${cond} block 缺失`).not.toBe('');
      expect(block).toMatch(/--blur-glass:\s*0px/);
      expect(block).toMatch(/\.tp-bottom-nav,\s*\.tp-page-bottom-bar\s*\{\s*background:\s*var\(--color-background\)/);
      expect(block).toMatch(/--tabbar-filter:\s*none/);
    });
  }
});

describe('W5 G16 — 桌機底部列 offset 對齊 sidebar', () => {
  it('.tp-page-bottom-bar 桌機 left 用 --sidebar-width-desktop，非 hardcoded 240px', () => {
    // 桌機 @media 內的 .tp-page-bottom-bar left。
    const m = CSS.match(/@media \(min-width: 1024px\)\s*\{\s*\.tp-page-bottom-bar\s*\{[\s\S]*?left:\s*([^;]+);/);
    expect(m, '找不到桌機 .tp-page-bottom-bar left').not.toBeNull();
    expect(m![1]!.trim()).toBe('var(--sidebar-width-desktop)');
  });

  it('--sidebar-width-desktop 與 grid sidebar 欄同值（216px）', () => {
    expect(CSS).toMatch(/--sidebar-width-desktop:\s*216px/);
    expect(CSS).toMatch(/--grid-3pane-desktop:\s*216px/);
  });
});
