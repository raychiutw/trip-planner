/**
 * Value: protects=觸控目標違規棘輪的比對（標籤以前綴比對、最短邊須相同）；
 *   fails_when=新增違規沒被抓、已修好卻留在清單沒被抓、標籤只差截斷長度就誤報；
 *   why_new=比對原本寫在 e2e spec 內，aria-label 一改清單就得手動同步；seam=none；no_claim=實際頁面量測
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error CJS 模組沒有型別
import { diffViolations } from '../e2e/hig-known-violations';

describe('diffViolations（棘輪兩個方向）', () => {
  it('清單寫穩定前綴即可比對到被截斷的長標籤', () => {
    const r = diffViolations(['13 min · 6.6 km · 從飯店開車  286x32'], ['13 min · 6.6 km 32x286']);
    expect(r).toEqual({ fresh: [], fixed: [] });
  });

  it('新增違規 → fresh 非空', () => {
    expect(diffViolations(['新按鈕 40x30'], []).fresh).toEqual(['新按鈕 40x30']);
  });

  it('同標籤但最短邊不同視為新違規', () => {
    expect(diffViolations(['送出 40x20'], ['送出 40x40']).fresh).toEqual(['送出 40x20']);
  });

  it('已修好但還在清單 → fixed 非空', () => {
    expect(diffViolations([], ['送出 40x40']).fixed).toEqual(['送出 40x40']);
  });
});
