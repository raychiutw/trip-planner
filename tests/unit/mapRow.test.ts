/**
 * mapRow.test.ts — snake_case → camelCase + JSON parse
 * v2.33.53 round 9: src/lib zero-test catch-up
 */
import { describe, it, expect } from 'vitest';
import { snakeToCamel, mapRow, mapRows, JSON_FIELDS } from '../../src/lib/mapRow';

describe('snakeToCamel', () => {
  it('純小寫 → 不變', () => {
    expect(snakeToCamel('foo')).toBe('foo');
  });

  it('snake_case 轉 camelCase', () => {
    expect(snakeToCamel('day_quota')).toBe('dayQuota');
    expect(snakeToCamel('owner_user_id')).toBe('ownerUserId');
    expect(snakeToCamel('a_b_c_d')).toBe('aBCD');
  });

  it('leading underscore 也會被 regex 吃掉（_foo → Foo）', () => {
    // 實際行為：/_([a-z])/g 在字串開頭也會 match _f → F
    // 我們暫時記錄此 quirk；DB cols 從不以 _ 開頭，實務上不會撞到
    expect(snakeToCamel('_foo')).toBe('Foo');
  });

  it('空字串安全', () => {
    expect(snakeToCamel('')).toBe('');
  });
});

describe('mapRow', () => {
  it('null / undefined / primitive 返回原值', () => {
    expect(mapRow(null)).toBe(null);
    expect(mapRow(undefined)).toBe(undefined);
    expect(mapRow(42)).toBe(42);
    expect(mapRow('str')).toBe('str');
  });

  it('object key 轉 camelCase', () => {
    const input = { trip_id: 'okinawa-1', day_quota: 5 };
    expect(mapRow(input)).toEqual({ tripId: 'okinawa-1', dayQuota: 5 });
  });

  it('value 為 null / 數字 / 物件不被破壞', () => {
    const input = { foo_bar: null, baz_qux: 0, deep: { not_changed: true } };
    expect(mapRow(input)).toEqual({
      fooBar: null,
      bazQux: 0,
      deep: { not_changed: true },
    });
  });

  it('JSON_FIELDS 目前為空 array (v2.33.x cleanup)', () => {
    expect(JSON_FIELDS).toEqual([]);
  });
});

describe('mapRows', () => {
  it('non-array input 返回 []', () => {
    expect(mapRows(null)).toEqual([]);
    expect(mapRows({})).toEqual([]);
    expect(mapRows('abc')).toEqual([]);
  });

  it('array of rows 都 map', () => {
    const input = [
      { trip_id: 'a', day_num: 1 },
      { trip_id: 'b', day_num: 2 },
    ];
    expect(mapRows(input)).toEqual([
      { tripId: 'a', dayNum: 1 },
      { tripId: 'b', dayNum: 2 },
    ]);
  });

  it('空 array 返回空 array', () => {
    expect(mapRows([])).toEqual([]);
  });
});
