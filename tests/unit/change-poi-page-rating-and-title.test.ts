// @vitest-environment node
/**
 * v2.31.11 fix: change-poi page 搜尋結果 rating + section title 對 search/熱門兩態。
 *
 * Bug #7 part 2（同 AddStopPage 修法）：ChangePoiPage 也有同樣的 hard-coded
 * 「熱門景點 · {region}」section title + 搜尋 card 孤兒 star icon + favorites
 * card 孤兒 star icon。Copy-paste pattern → 同樣 fix。
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/ChangePoiPage.tsx'),
  'utf8',
);

describe('v2.31.11 ChangePoiPage rating + section title', () => {
  it('section title 搜尋態 vs 熱門態二選一', () => {
    expect(SRC).toMatch(/query\.trim\(\)\.length >= 2\s*\?\s*'搜尋結果'\s*:\s*'熱門景點'/);
  });

  it('search card meta：rating 存在才 render ★ + N.N', () => {
    expect(SRC).toMatch(/typeof result\.rating === 'number'/);
    expect(SRC).toMatch(/result\.rating\.toFixed\(1\)/);
    expect(SRC).toMatch(/tp-change-poi-card-meta-sep/);
  });

  it('favorites card 拔掉孤兒 star icon', () => {
    const cardNameIdx = SRC.indexOf('className="tp-change-poi-card-name">{favorite.poiName}');
    expect(cardNameIdx).toBeGreaterThan(0);
    const cardBlock = SRC.slice(cardNameIdx, cardNameIdx + 600);
    expect(cardBlock).toContain('poiAddress');
    expect(cardBlock).not.toMatch(/<Icon name="star" \/>/);
  });
});
