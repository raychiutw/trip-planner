// @vitest-environment node
/**
 * v2.31.12 fix: ExplorePage POI 卡片 rating 顯示。
 *
 * Bug discovered in prod QA tour：ExplorePage 用 placeholder「探索更多評論」
 * 寫死。Comment 寫「真實 rating 待 backend 提供」但 v2.23.0 google-maps-migration
 * 後 backend `PoiSearchResult.rating` 已含 Google rating。
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

describe('v2.31.12 ExplorePage rating display', () => {
  it('有 rating 顯示 N.N，無 rating fallback「探索更多評論」', () => {
    expect(SRC).toMatch(/typeof poi\.rating === 'number'/);
    expect(SRC).toMatch(/poi\.rating\.toFixed\(1\)/);
    // fallback 字串仍存在
    expect(SRC).toContain('探索更多評論');
  });

  it('placeholder comment 已更新（不再說「待 backend 提供」）', () => {
    expect(SRC).not.toMatch(/真實 rating 待 backend\s*提供 Google rating 接入；先用 placeholder/);
  });
});
