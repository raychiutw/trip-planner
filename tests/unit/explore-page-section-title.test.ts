// @vitest-environment node
/**
 * v2.31.55 fix: ExplorePage section header conditional on query state。
 *
 * Bug (prod QA found)：landing 自動 auto-search「東京」seed → results 有值，
 * section header 寫死「搜尋結果」。但 user 點「為你推薦」tab 仍看到「搜尋結果」
 * → 語意衝突（user 沒 search 卻看到 search results header）。
 *
 * Fix：對齊 AddStopPage / ChangePoiPage 同樣 search/landing 切換邏輯，
 * query.trim().length >= 2 → 「搜尋結果」；空 → 「推薦景點」。
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

describe('v2.31.55 ExplorePage section title', () => {
  it('section title 搜尋態 vs 推薦態二選一（不再寫死「搜尋結果」）', () => {
    expect(SRC).toMatch(/query\.trim\(\)\.length >= 2\s*\?\s*'搜尋結果'\s*:\s*'推薦景點'/);
  });

  it('section 動態 render sectionTitle 變數（不是寫死 string literal）', () => {
    expect(SRC).toMatch(/<h2>\{sectionTitle\}<\/h2>/);
  });

  it('hardcoded「搜尋結果」JSX 已移除（取代成動態變數）', () => {
    expect(SRC).not.toMatch(/<h2>搜尋結果<\/h2>/);
  });
});
