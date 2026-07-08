/**
 * poi-search-helpers.test.ts — v2.33.37 round 2 coverage
 *
 * PR-7 extract 自 AddStopPage + ChangePoiPage 的 6 個 pure helper。每個 page
 * 都依賴 normalizeSearchResults 把 Google Places raw result 轉成可用 row；
 * silent drift 會讓搜尋結果空白。
 */
import { describe, it, expect } from 'vitest';
import {
  matchCategory,
  poiTone,
  poiMeta,
  normalizeSearchResults,
  REGION_OPTIONS,
  CATEGORY_TABS,
} from '../../src/lib/poiSearchHelpers';

describe('REGION_OPTIONS / CATEGORY_TABS const', () => {
  it('REGION_OPTIONS 6 個 entries 首位為「全部地區」', () => {
    expect(REGION_OPTIONS).toHaveLength(6);
    expect(REGION_OPTIONS[0]).toBe('全部地區');
    expect(REGION_OPTIONS).toContain('沖繩');
    expect(REGION_OPTIONS).toContain('東京');
    expect(REGION_OPTIONS).toContain('京都');
    expect(REGION_OPTIONS).toContain('首爾');
    expect(REGION_OPTIONS).toContain('台南');
  });

  it('CATEGORY_TABS 5 個 entries 首位為「為你推薦」/ all', () => {
    expect(CATEGORY_TABS).toHaveLength(5);
    expect(CATEGORY_TABS[0]).toEqual({ key: 'all', label: '為你推薦' });
    expect(CATEGORY_TABS.map((t) => t.key)).toEqual([
      'all', 'attraction', 'food', 'hotel', 'shopping',
    ]);
  });
});

describe('matchCategory', () => {
  it('"all" matches anything (含 null / undefined)', () => {
    expect(matchCategory(null, 'all')).toBe(true);
    expect(matchCategory('random_thing', 'all')).toBe(true);
  });

  it('"food" matches restaurant / cafe / 餐 / 食', () => {
    expect(matchCategory('restaurant', 'food')).toBe(true);
    expect(matchCategory('cafe', 'food')).toBe(true);
    expect(matchCategory('bakery', 'food')).toBe(true);
    expect(matchCategory('日式餐館', 'food')).toBe(true);
    expect(matchCategory('美食街', 'food')).toBe(true);
  });

  it('"hotel" matches hotel / hostel / 飯店', () => {
    expect(matchCategory('hotel', 'hotel')).toBe(true);
    expect(matchCategory('hostel', 'hotel')).toBe(true);
    expect(matchCategory('飯店', 'hotel')).toBe(true);
  });

  it('"shopping" matches shop / mall / 購物', () => {
    expect(matchCategory('shop', 'shopping')).toBe(true);
    expect(matchCategory('mall', 'shopping')).toBe(true);
    expect(matchCategory('購物中心', 'shopping')).toBe(true);
  });

  it('"attraction" matches museum / park / 景點 / 公園', () => {
    expect(matchCategory('museum', 'attraction')).toBe(true);
    expect(matchCategory('park', 'attraction')).toBe(true);
    expect(matchCategory('景點', 'attraction')).toBe(true);
    expect(matchCategory('国営公園', 'attraction')).toBe(true);
  });

  it('non-matching category returns false', () => {
    expect(matchCategory('parking', 'food')).toBe(false);
    expect(matchCategory('cafe', 'hotel')).toBe(false);
    expect(matchCategory(null, 'food')).toBe(false);
  });
});

describe('poiTone', () => {
  it('restaurant → warm', () => {
    expect(poiTone('restaurant', 0)).toBe('warm');
    expect(poiTone('餐廳', 5)).toBe('warm');
  });

  it('shop → amber', () => {
    expect(poiTone('shopping_mall', 0)).toBe('amber');
    expect(poiTone('購物', 1)).toBe('amber');
  });

  it('hotel → cool', () => {
    expect(poiTone('hotel', 0)).toBe('cool');
    expect(poiTone('飯店', 0)).toBe('cool');
  });

  it('fallback by index → ocean / cool / amber / warm cycle', () => {
    expect(poiTone('museum', 0)).toBe('blue');
    expect(poiTone('museum', 1)).toBe('cool');
    expect(poiTone('museum', 2)).toBe('amber');
    expect(poiTone('museum', 3)).toBe('warm');
    expect(poiTone('museum', 4)).toBe('blue');
  });
});

describe('poiMeta', () => {
  it('extracts first comma-segment of address', () => {
    expect(poiMeta('東京都新宿區 1-2-3, 日本', 'restaurant')).toBe('東京都新宿區 1-2-3');
  });

  it('address 缺省時 fallback 分類 — Google primaryType（英文）映射成中文，不露英文', () => {
    expect(poiMeta('', 'restaurant')).toBe('餐廳');
    expect(poiMeta(null, 'hotel')).toBe('飯店');
    expect(poiMeta('', 'tourist_attraction')).toBe('景點');
    // 已是中文的自訂分類 → 原樣顯示
    expect(poiMeta('', '居酒屋')).toBe('居酒屋');
  });

  it('falls back to "景點" when both empty', () => {
    expect(poiMeta('', '')).toBe('景點');
    expect(poiMeta(null, null)).toBe('景點');
  });
});

describe('normalizeSearchResults', () => {
  it('handles array input directly', () => {
    const input = [
      { place_id: 'ChIJabc', name: 'A店', address: 'x', lat: 10, lng: 20, category: 'restaurant', rating: 4.5 },
    ];
    const out = normalizeSearchResults(input);
    expect(out).toHaveLength(1);
    expect(out[0]?.place_id).toBe('ChIJabc');
    expect(out[0]?.rating).toBe(4.5);
  });

  it('handles { results: [...] } wrapped input', () => {
    const input = { results: [{ place_id: 'ChIJxyz', name: 'B店', address: 'y', lat: 1, lng: 2, category: 'cafe' }] };
    const out = normalizeSearchResults(input);
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe('B店');
  });

  it('filters rows missing place_id or name (strict)', () => {
    const input = [
      { place_id: 'ChIJok', name: 'OK', address: '', lat: 0, lng: 0, category: '' },
      { place_id: '', name: 'no-id' }, // filtered: missing place_id
      { place_id: 'ChIJno-name', name: '' }, // filtered: empty name
      { place_id: 'ChIJno-name2', name: '   ' }, // filtered: whitespace-only name
    ];
    const out = normalizeSearchResults(input);
    expect(out).toHaveLength(1);
    expect(out[0]?.place_id).toBe('ChIJok');
  });

  it('returns empty array for null / undefined / non-object', () => {
    expect(normalizeSearchResults(null)).toEqual([]);
    expect(normalizeSearchResults(undefined)).toEqual([]);
    expect(normalizeSearchResults('not-an-array')).toEqual([]);
    expect(normalizeSearchResults(42)).toEqual([]);
  });

  it('drops rating when not a number (strict type check)', () => {
    const input = [
      { place_id: 'ChIJ1', name: 'N', rating: '4.5' /* string, not number */ },
    ];
    const out = normalizeSearchResults(input);
    expect(out[0]?.rating).toBeUndefined();
  });

  it('defaults missing lat/lng to 0', () => {
    const input = [{ place_id: 'ChIJ1', name: 'N' }];
    const out = normalizeSearchResults(input);
    expect(out[0]?.lat).toBe(0);
    expect(out[0]?.lng).toBe(0);
  });

  it('defaults missing category to "poi"', () => {
    const input = [{ place_id: 'ChIJ1', name: 'N' }];
    const out = normalizeSearchResults(input);
    expect(out[0]?.category).toBe('poi');
  });
});
