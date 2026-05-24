/**
 * dead-css-cleanup.test.ts — F001 TDD red test
 *
 * 驗證 tokens.css 不含 top-level (非 @media print 內) 的 dead CSS selectors：
 * - .tp-body
 * - .tp-main
 * - .tp-side（非 .tp-side-card 等衍生 class）
 * - .info-panel（InfoPanel 已 orphan）
 *
 * 同時驗證 TripPage.tsx 的 SCOPED_STYLES 不含 dead .info-panel rule（InfoPanel 已於 F001 刪除）
 *
 * @media print 內部允許保留（未檢查）
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const tokensPath = join(process.cwd(), 'css', 'tokens.css');
const css = readFileSync(tokensPath, 'utf-8');

const tripPagePath = join(process.cwd(), 'src', 'pages', 'TripPage.tsx');
const tripPageSrc = readFileSync(tripPagePath, 'utf-8');

/**
 * 從 CSS 移除 @media print block 後的內容，
 * 再去除所有 body.print-mode 規則，以排除 print-mode 相關合法保留。
 */
function removePrintBlocks(src: string): string {
  // Remove body.print-mode {...} rule blocks
  return src.replace(/body\.print-mode\s+[^{]*\{[^}]*\}/g, '');
}

const nonPrintCss = removePrintBlocks(css);

describe('tokens.css — dead CSS 清理 (F001)', () => {
  it('不含 top-level .tp-body selector（非 print-mode）', () => {
    // Match standalone .tp-body { (not inside body.print-mode)
    const match = nonPrintCss.match(/(?<![a-z-])\.(tp-body)\s*\{/);
    expect(match).toBeNull();
  });

  it('不含 top-level .tp-main selector', () => {
    const match = nonPrintCss.match(/(?<![a-z-])\.(tp-main)\s*\{/);
    expect(match).toBeNull();
  });

  it('不含 top-level .tp-side selector（tp-side-card 允許保留）', () => {
    // Match .tp-side { but not .tp-side-card
    const match = nonPrintCss.match(/\.(tp-side)\s*\{/);
    expect(match).toBeNull();
  });

  it('不含 .info-panel selector（InfoPanel 已 orphan）', () => {
    const match = css.match(/\.(info-panel)\s*[\{,]/);
    expect(match).toBeNull();
  });

  it('不含 --info-panel-w CSS variable 宣告', () => {
    const match = css.match(/--info-panel-w\s*:/);
    expect(match).toBeNull();
  });
});

describe('TripPage.tsx SCOPED_STYLES — dead CSS 清理 (PR5)', () => {
  it('SCOPED_STYLES 不含 .info-panel rule（InfoPanel 已於 F001 刪除）', () => {
    // .info-panel should not appear anywhere in TripPage.tsx
    const match = tripPageSrc.match(/\.info-panel/);
    expect(match).toBeNull();
  });
});
