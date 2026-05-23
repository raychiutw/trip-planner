/**
 * dayArtMapping.test.ts — extractArtKeys behaviour
 * v2.33.53 round 9: src/lib zero-test catch-up
 */
import { describe, it, expect } from 'vitest';
import { extractArtKeys } from '../../src/lib/dayArtMapping';

describe('extractArtKeys', () => {
  it('回傳 ["default"] 當所有 title 都無 keyword 命中', () => {
    expect(extractArtKeys(['某個沒對到的標題'])).toEqual(['default']);
  });

  it('回傳 ["default"] 當 titles 為空 array', () => {
    expect(extractArtKeys([])).toEqual(['default']);
  });

  it('單一 keyword 命中時回傳對應 art key', () => {
    expect(extractArtKeys(['浮潛體驗'])).toEqual(['snorkel']);
  });

  it('多 keyword 命中時依 KEYWORD_MAPPINGS 順序回傳', () => {
    // 浮潛 (snorkel) 在 mappings 第一個；機場 (airport) 較後
    const result = extractArtKeys(['沖繩機場', '浮潛體驗']);
    expect(result[0]).toBe('snorkel');
    expect(result).toContain('airport');
  });

  it('多 title 同 art key 不重複（dedup）', () => {
    const result = extractArtKeys(['浮潛', 'シュノーケル']);
    expect(result).toEqual(['snorkel']);
  });

  it('limit 參數限制回傳數量', () => {
    const result = extractArtKeys(['浮潛', '機場', '飯店', '咖啡', '博物館'], 2);
    expect(result).toHaveLength(2);
  });

  it('英文 keyword 命中（case-sensitive，"Beach" 含 "Beach"）', () => {
    expect(extractArtKeys(['Sunset Beach'])).toContain('beach');
  });

  it('日文 keyword 命中（ビーチ → beach）', () => {
    expect(extractArtKeys(['ビーチ'])).toEqual(['beach']);
  });

  it('default limit 為 3', () => {
    const result = extractArtKeys(['浮潛', '機場', '飯店', '咖啡', '博物館']);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});
