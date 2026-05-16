// @vitest-environment node
/**
 * v2.31.32 fix #133: PoiFavoritesPage region filter row 只有 1 region group 時 hide。
 *
 * Bug 取證（prod QA mobile）：favorites 只有 3 個 POI 都被 derive 進「其他」region。
 * regionCounts = { all: 3, 其他: 3 }，regionOptions = ['其他']。Render 出「全部 3 / 其他 3」
 * 兩個 tab — count 完全等價，UI 多餘，user 困惑「該選哪個？」
 *
 * Fix：regionOptions.length >= 2 才 render region row（有實際 filter 意義）。
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/PoiFavoritesPage.tsx'),
  'utf8',
);

describe('v2.31.32 PoiFavoritesPage region row hide-when-single', () => {
  it('region row 用 regionOptions.length >= 2 guard 包起來', () => {
    expect(SRC).toMatch(/regionOptions\.length\s*>=\s*2\s*&&/);
  });

  it('region row 仍 render 「全部 + region buttons」結構（≥2 group 時）', () => {
    expect(SRC).toMatch(/data-testid="favorites-region-row"/);
    expect(SRC).toMatch(/data-testid="favorites-region-all"/);
    expect(SRC).toMatch(/favorites-region-\$\{r\}/);
  });

  it('type row 不受影響（仍永遠 render）', () => {
    // type row 不該被 guard 包進去
    const typeRowMatch = SRC.match(/data-testid="favorites-type-row"/);
    expect(typeRowMatch).not.toBeNull();
    // type row 前 200 chars 不該有 .length >= 2 guard
    const idx = SRC.indexOf('data-testid="favorites-type-row"');
    const ctx = SRC.slice(Math.max(0, idx - 300), idx);
    expect(ctx).not.toMatch(/typeOptions\.length\s*>=\s*2\s*&&/);
  });
});
