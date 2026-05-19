/**
 * v2.32.5 fix — `.tp-map-day-tabs` 水平 scroll 缺 affordance regression。
 *
 * Bug context：7-day trip 在 mobile viewport (≤390px) day 6/7 chips 超出
 * viewport，無 scrollbar (`scrollbar-width: none`) 也無 chevron icon → user
 * 看不到「往右還有 chips」hint，常以為 trip 只有 5 天。
 *
 * Fix：右側 24px linear-gradient mask-image fade，提示 horizontal scroll
 * 可繼續。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const TOKENS_CSS = readFileSync(
  path.resolve(__dirname, '../../css/tokens.css'),
  'utf8',
);

describe('tokens.css — .tp-map-day-tabs scroll affordance', () => {
  it('mask-image 右側 fade linear-gradient 已加', () => {
    expect(TOKENS_CSS).toMatch(
      /\.tp-map-day-tabs\s*\{[\s\S]{0,800}mask-image:\s*linear-gradient\(to right,\s*#000\s+calc\(100% - 24px\),\s*transparent 100%\)/,
    );
  });

  it('-webkit-mask-image vendor prefix 也加（Safari/iOS）', () => {
    expect(TOKENS_CSS).toMatch(
      /\.tp-map-day-tabs\s*\{[\s\S]{0,800}-webkit-mask-image:\s*linear-gradient\(to right,\s*#000\s+calc\(100% - 24px\),\s*transparent 100%\)/,
    );
  });

  it('原本 overflow-x: auto + scrollbar-width: none 保留', () => {
    expect(TOKENS_CSS).toMatch(/\.tp-map-day-tabs\s*\{[\s\S]{0,400}overflow-x:\s*auto/);
    expect(TOKENS_CSS).toMatch(/\.tp-map-day-tabs\s*\{[\s\S]{0,400}scrollbar-width:\s*none/);
  });
});
