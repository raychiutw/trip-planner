// @vitest-environment node
/**
 * v2.31.20 fix #121: ExplorePage 搜尋結果 card 的 poi-category 應顯中文 label，
 * 不應 dump Google Places raw enum (e.g. RAMEN_RESTAURANT)。
 *
 * Bug 取證（prod QA）：搜尋「拉麵」3 張結果卡分別顯：
 *   - RAMEN_RESTAURANT
 *   - RESTAURANT
 *   - RAMEN_RESTAURANT
 * 對中文使用者無意義，且不一致（同類別出 2 種 enum）。
 *
 * Fix：走 `POI_TYPE_LABELS[mapNominatimCategory(poi.category)]` 把 Google
 * Places 細分 type → Tripline whitelist enum → 中文 label。Helpers 已存在
 * 於 src/lib/poiCategory.ts；ExplorePage 只是沒用上。
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

describe('v2.31.20 → v2.55.73 ExplorePage poi-category 中文化 / 細類化', () => {
  it('import 含 poiCategoryLabel', () => {
    expect(SRC).toMatch(/import \{[^}]*poiCategoryLabel[^}]*\} from '\.\.\/lib\/poiCategory'/);
  });

  it('v2.55.73 poi-category 走 poiCategoryLabel（細類；未收錄英文 fallback 於 helper 內）', () => {
    const cardMatch = SRC.match(
      /className="poi-category">\{poiCategoryLabel\(poi\.category\)\s*\?\?\s*'POI'\}/,
    );
    expect(cardMatch).not.toBeNull();
  });

  it('不再 raw render poi.category（避免 RAMEN_RESTAURANT raw enum 出現）', () => {
    expect(SRC).not.toMatch(/className="poi-category">\{poi\.category \|\| 'POI'\}/);
    // 也不再壓成粗類 POI_TYPE_LABELS（v2.55.73 改細類 poiCategoryLabel）
    expect(SRC).not.toMatch(/className="poi-category">\{POI_TYPE_LABELS\[mapNominatimCategory/);
  });

  it('fallback 文案保留「POI」（rating 無值 / 全空時的 placeholder）', () => {
    expect(SRC).toMatch(/\?\?\s*'POI'/);
  });
});
