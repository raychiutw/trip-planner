// @vitest-environment node
/**
 * v2.31.10 fix: add-stop page 搜尋結果 rating + section title 對 search/熱門兩態。
 *
 * Bug #7（prod QA found）：
 *   - section title 寫死「熱門景點 · {region}」，搜尋態語意不對
 *   - 搜尋 card 用 Icon name="star" 但 normalizeSearchResults 沒抽 rating，
 *     star 後面接 address 看起來像 broken
 *   - 收藏 card 同樣 star icon 沒值（poi-favorites SELECT 沒拿 rating）
 *
 * Pure-text grep on source (對齊 add-stop-page-region-filter.test.ts pattern)。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/AddStopPage.tsx'),
  'utf8',
);

describe('v2.31.10 AddStopPage rating + section title', () => {
  it('normalizeSearchResults 抽出 rating（v2.31.10 fix）', () => {
    expect(SRC).toMatch(/typeof item\.rating === 'number'/);
    // 確保 rating 真的塞進 return object
    const fnMatch = SRC.match(/function normalizeSearchResults[\s\S]*?\n\}\n/);
    expect(fnMatch).not.toBeNull();
    expect(fnMatch?.[0]).toMatch(/rating,?\s*\n/);
  });

  it('section title 搜尋態 vs 熱門態二選一（不再寫死「熱門景點」）', () => {
    expect(SRC).toMatch(/query\.trim\(\)\.length >= 2\s*\?\s*'搜尋結果'\s*:\s*'熱門景點'/);
  });

  it('search card meta：rating 存在才 render ★ + N.N，否則只 address', () => {
    expect(SRC).toMatch(/typeof r\.rating === 'number'/);
    expect(SRC).toMatch(/r\.rating\.toFixed\(1\)/);
    // 分隔符 class 存在
    expect(SRC).toMatch(/tp-add-stop-card-meta-sep/);
  });

  it('favorites card 拔掉孤兒 star icon（沒 rating data 避免誤導）', () => {
    // 找 favorites card-name + card-meta block（r.poiName 在 card 內出現）
    const cardNameIdx = SRC.indexOf('className="tp-add-stop-card-name">{r.poiName}');
    expect(cardNameIdx).toBeGreaterThan(0);
    // 取 card-name 起算 600 char 範圍涵蓋 card-meta 整段
    const cardBlock = SRC.slice(cardNameIdx, cardNameIdx + 600);
    expect(cardBlock).toContain('poiAddress');
    // 不再有 star icon
    expect(cardBlock).not.toMatch(/<Icon name="star" \/>/);
  });
});
