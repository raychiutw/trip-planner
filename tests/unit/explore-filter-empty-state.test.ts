// @vitest-environment node
/**
 * v2.31.22 fix #123: ExplorePage category filter 0 結果應顯 empty state，
 * 不應留 grid 空白讓 user 迷路。
 *
 * Bug 取證（prod QA）：搜尋「拉麵」→ 切到「景點」filter chip → 0 個結果，
 * grid 完全空白，user 不知如何救回（要點別 chip）。
 *
 * Fix：filtered.length === 0 時插 empty state placeholder + 「回到為你推薦」
 * reset button（onClick setCategory('all')）+ CATEGORY_LABELS 中文 label。
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/ExplorePage.tsx'),
  'utf8',
);

describe('v2.31.22 ExplorePage filter empty state', () => {
  it('filter empty state JSX 存在（filtered.length === 0 conditional）', () => {
    expect(SRC).toMatch(/filtered\.length === 0 \?/);
    expect(SRC).toMatch(/data-testid="explore-filter-empty"/);
  });

  it('v2.55.73 文案含「沒有符合」+ 顯示當前細類 label（activeCategory）', () => {
    // v2.55.73：靜態 5 類 CATEGORY_LABELS 改為動態細類 → empty state 直接顯 activeCategory label。
    expect(SRC).toMatch(/沒有符合「\{activeCategory\}」/);
  });

  it('Reset CTA「回到為你推薦」+ onClick setCategory(\'all\')', () => {
    expect(SRC).toMatch(/回到為你推薦/);
    expect(SRC).toMatch(/onClick=\{\(\) => setCategory\('all'\)\}/);
    expect(SRC).toMatch(/data-testid="explore-filter-empty-reset"/);
  });

  it('CSS 新規則 .explore-filter-empty / .explore-filter-empty-reset 存在', () => {
    expect(SRC).toMatch(/\.explore-filter-empty\s*\{/);
    expect(SRC).toMatch(/\.explore-filter-empty-reset\s*\{/);
  });
});
