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

  it('favorites card rating 存在才 render ★ N.N（v2.31.17 backend 補 rating SELECT 後恢復）', () => {
    const cardNameIdx = SRC.indexOf('className="tp-add-stop-card-name">{r.poiName}');
    expect(cardNameIdx).toBeGreaterThan(0);
    // window 取 1400 char（深縮排每行 ~80 chars × 18 行）涵蓋 card-body 整段
    const cardBlock = SRC.slice(cardNameIdx, cardNameIdx + 1400);
    expect(cardBlock).toMatch(/poiMeta\(r\.poiAddress/);
    // v2.31.17: backend SELECT 補 p.rating，favorites card 跟 search card 一致顯 ★
    expect(cardBlock).toMatch(/typeof r\.poiRating === 'number'/);
    expect(cardBlock).toMatch(/r\.poiRating\.toFixed\(1\)/);
  });
});

describe('v2.31.17 AddStopPage favorites rating wiring', () => {
  it('PoiFavoriteRow type 含 poiRating 欄位', () => {
    expect(SRC).toMatch(/poiRating\?:\s*number\s*\|\s*null/);
  });

  it('normalizePoiFavorites 抽 camelCase poiRating + snake_case poi_rating fallback', () => {
    expect(SRC).toMatch(/typeof item\.poiRating === 'number'/);
    expect(SRC).toMatch(/typeof item\.poi_rating === 'number'/);
  });
});
