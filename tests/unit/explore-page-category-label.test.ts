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

describe('v2.31.20 ExplorePage poi-category 中文化', () => {
  it('import 含 POI_TYPE_LABELS', () => {
    expect(SRC).toMatch(/import \{[^}]*POI_TYPE_LABELS[^}]*\} from '\.\.\/lib\/poiCategory'/);
  });

  it('poi-category 走 mapNominatimCategory → POI_TYPE_LABELS', () => {
    const cardMatch = SRC.match(
      /className="poi-category"[\s\S]{0,200}POI_TYPE_LABELS\[mapNominatimCategory\(poi\.category\)\]/,
    );
    expect(cardMatch).not.toBeNull();
  });

  it('不再 raw render poi.category（避免 RAMEN_RESTAURANT 出現）', () => {
    // poi-category div 不應該再含 `{poi.category || 'POI'}` 這個原本的寫法
    expect(SRC).not.toMatch(/className="poi-category">\{poi\.category \|\| 'POI'\}/);
  });

  it('fallback 文案保留「POI」（rating 無值 / 全空時的 placeholder）', () => {
    // helper 永遠回 PoiType（不會 undefined），POI_TYPE_LABELS 也有對應 label，
    // 嚴格說 fallback 不會觸發；保留 ?? 'POI' 作為防呆。
    expect(SRC).toMatch(/\?\?\s*'POI'/);
  });
});
