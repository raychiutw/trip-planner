// @vitest-environment node
/**
 * v2.31.19 fix #120: PoiFavoritesPage card 顯示 ★ rating。
 *
 * Bug 取證（prod QA）：v2.31.17 backend poi-favorites GET SELECT 已含
 * `p.rating AS poi_rating`，但主收藏頁 `/favorites` 的 PoiFavoritesPage
 * card 完全沒 reference rating — type / name / address / usage badge 都有，
 * 就缺 ★ 顯示。AddStopPage / ChangePoiPage favorites card 已修，主頁忘了。
 *
 * Fix：`PoiFavoriteRow` interface 加 `poiRating?: number | null`，card
 * body 加 `★ N.N · address` conditional，rating 不存在則只顯 address。
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

describe('v2.31.19 PoiFavoritesPage card rating display', () => {
  it('PoiFavoriteRow interface 含 poiRating?: number | null', () => {
    const ifaceMatch = SRC.match(/interface PoiFavoriteRow\s*\{[\s\S]*?\}/);
    expect(ifaceMatch).not.toBeNull();
    expect(ifaceMatch?.[0]).toMatch(/poiRating\?:\s*number\s*\|\s*null/);
  });

  it('card body conditional render ★ N.N（rating 存在才顯）', () => {
    expect(SRC).toMatch(/typeof row\.poiRating === 'number'/);
    expect(SRC).toMatch(/row\.poiRating\.toFixed\(1\)/);
    expect(SRC).toMatch(/poi-rating/);
  });

  it('rating + address 並列時用 " · " 分隔，rating 缺則只顯 address', () => {
    expect(SRC).toMatch(/poi-meta-sep/);
    // 條件：rating 存在 + address 存在才插分隔符
    expect(SRC).toMatch(/typeof row\.poiRating === 'number' && \([\s\S]*?row\.poiAddress && /);
  });

  it('CSS 新規則 .poi-rating 與 .poi-meta-sep', () => {
    expect(SRC).toMatch(/\.favorites-card \.poi-rating/);
    expect(SRC).toMatch(/\.favorites-card \.poi-meta-sep/);
  });
});
