/**
 * local-storage-shape.test.ts — v2.33.38 round 3 LOW finding
 *
 * `lsGet` 對 malformed envelope (NaN exp / 缺欄位 / wrong type) 要視作損壞
 * 並 silent remove + return null。defense in depth：even 同 origin 攻擊者
 * 寫入也擋下。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { lsSet, lsGet, lsRemove, LS_PREFIX } from '../../src/lib/localStorage';

beforeEach(() => {
  localStorage.clear();
});

describe('lsGet — shape validation (v2.33.38 round 3)', () => {
  it('returns value for valid envelope', () => {
    lsSet('foo', { a: 1 });
    expect(lsGet('foo')).toEqual({ a: 1 });
  });

  it('returns null + removes entry when JSON.parse throws', () => {
    localStorage.setItem(LS_PREFIX + 'broken', '{not valid json');
    expect(lsGet('broken')).toBeNull();
    expect(localStorage.getItem(LS_PREFIX + 'broken')).toBeNull();
  });

  it('returns null + removes entry when missing exp field', () => {
    localStorage.setItem(LS_PREFIX + 'no-exp', JSON.stringify({ v: 'x' }));
    expect(lsGet('no-exp')).toBeNull();
    expect(localStorage.getItem(LS_PREFIX + 'no-exp')).toBeNull();
  });

  it('returns null when exp is a string (wrong type)', () => {
    localStorage.setItem(LS_PREFIX + 'wrong-type', JSON.stringify({ v: 'x', exp: 'never' }));
    expect(lsGet('wrong-type')).toBeNull();
    expect(localStorage.getItem(LS_PREFIX + 'wrong-type')).toBeNull();
  });

  it('returns null when exp is NaN', () => {
    localStorage.setItem(LS_PREFIX + 'nan-exp', JSON.stringify({ v: 'x', exp: NaN }));
    expect(lsGet('nan-exp')).toBeNull();
  });

  it('returns null when payload is not an object (e.g. top-level array)', () => {
    localStorage.setItem(LS_PREFIX + 'array', JSON.stringify([]));
    expect(lsGet('array')).toBeNull();
  });

  it('returns null when payload is null', () => {
    localStorage.setItem(LS_PREFIX + 'null', JSON.stringify(null));
    expect(lsGet('null')).toBeNull();
  });

  it('returns null + removes for expired entry', () => {
    localStorage.setItem(
      LS_PREFIX + 'expired',
      JSON.stringify({ v: 'x', exp: Date.now() - 1000 }),
    );
    expect(lsGet('expired')).toBeNull();
    expect(localStorage.getItem(LS_PREFIX + 'expired')).toBeNull();
  });

  it('lsRemove 清掉 valid entry', () => {
    lsSet('a', 1);
    lsRemove('a');
    expect(lsGet('a')).toBeNull();
  });
});
