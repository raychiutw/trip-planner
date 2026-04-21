/**
 * mobile-type-scale.test.ts — F003 TDD test
 *
 * 驗證 tokens.css 在 @media (max-width: 760px) 下的 .ocean-hero-title
 * 採用 DESIGN.md 規定的 24px（非 22px）。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const TOKENS_CSS = resolve(__dirname, '../../css/tokens.css');
const source = readFileSync(TOKENS_CSS, 'utf-8');

describe('F003 — Mobile Type Scale 真正落地', () => {
  it('tokens.css 在 @media (max-width: 760px) 下 .ocean-hero-title 使用 24px', () => {
    // 找到 760px 媒體查詢區塊內的 ocean-hero-title font-size
    // 應為 24px（DESIGN.md hero title mobile 規範）
    const mobileMediaMatch = source.match(
      /@media\s*\(max-width:\s*760px\)[^{]*\{([\s\S]*?)(?=@media|\s*}\s*(?:\/\*|$))/g,
    );
    expect(mobileMediaMatch).not.toBeNull();

    // 在 760px 媒體查詢段落中找到 ocean-hero-title: 24px
    const has24pxHeroTitle = mobileMediaMatch?.some(
      (block) => block.includes('.ocean-hero-title') && block.includes('24px'),
    );
    expect(has24pxHeroTitle).toBe(true);
  });
});
