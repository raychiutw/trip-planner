/**
 * tokens.css `@media (prefers-reduced-motion: reduce)` global override 測試
 * （B-P6 task 3.2 + 3.4）
 *
 * 驗 tokens.css 含 reduced-motion 全域 override，避免有前庭疾病的使用者被
 * 強制看大幅 animation / transition。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TOKENS = fs.readFileSync(
  path.resolve(__dirname, '../../css/tokens.css'),
  'utf8',
);

describe('tokens.css — prefers-reduced-motion override', () => {
  it('包含 @media (prefers-reduced-motion: reduce) block', () => {
    expect(TOKENS).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
  });

  it('override 涵蓋 animation-duration / transition-duration / scroll-behavior', () => {
    const block = TOKENS.match(
      /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{[\s\S]*?\n\}/,
    )?.[0];
    expect(block, 'reduced-motion @media block 必須存在').toBeTruthy();
    expect(block).toMatch(/animation-duration:\s*0\.01ms/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms/);
    expect(block).toMatch(/scroll-behavior:\s*auto/);
  });

  it('用 universal selector 套到所有 element + ::before + ::after', () => {
    const block = TOKENS.match(
      /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{[\s\S]*?\n\}/,
    )?.[0] ?? '';
    expect(block).toMatch(/\*[\s,]/);
    expect(block).toMatch(/::before/);
    expect(block).toMatch(/::after/);
  });

  it('使用 !important 確保覆蓋已存在的 transition/animation 規則', () => {
    const block = TOKENS.match(
      /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{[\s\S]*?\n\}/,
    )?.[0] ?? '';
    expect(block).toMatch(/animation-duration:[^;]*!important/);
    expect(block).toMatch(/transition-duration:[^;]*!important/);
  });
});
