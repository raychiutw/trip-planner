import { describe, it, expect } from 'vitest';
import { mapRow, mapRows, snakeToCamel, JSON_FIELDS } from '../../src/lib/mapRow.ts';

/* ===== snakeToCamel ===== */
describe('snakeToCamel', () => {
  it('converts google_rating to googleRating', () => {
    expect(snakeToCamel('google_rating')).toBe('googleRating');
  });

  it('converts day_of_week to dayOfWeek', () => {
    expect(snakeToCamel('day_of_week')).toBe('dayOfWeek');
  });

  it('leaves non-snake keys unchanged', () => {
    expect(snakeToCamel('description')).toBe('description');
  });

  it('converts trip_id to tripId', () => {
    expect(snakeToCamel('trip_id')).toBe('tripId');
  });

  it('converts created_at to createdAt', () => {
    expect(snakeToCamel('created_at')).toBe('createdAt');
  });
});

/* ===== mapRow — snake_case to camelCase ===== */
describe('mapRow — snake_case to camelCase conversion', () => {
  it('converts must_buy to mustBuy', () => {
    expect(mapRow({ must_buy: '泡盛' }).mustBuy).toBe('泡盛');
  });

  it('converts reservation_url to reservationUrl', () => {
    expect(mapRow({ reservation_url: 'https://example.com' }).reservationUrl).toBe('https://example.com');
  });

  it('converts day_of_week to dayOfWeek', () => {
    expect(mapRow({ day_of_week: '三' }).dayOfWeek).toBe('三');
  });

  // 2026-05-02 (migration 0045): trips.self_drive 已 DROP，改用 default_travel_mode。
  // snakeToCamel 通用 rename 仍 work，這裡換用 default_travel_mode 驗證。
  it('converts default_travel_mode to defaultTravelMode', () => {
    expect(mapRow({ default_travel_mode: 'driving' }).defaultTravelMode).toBe('driving');
  });

  it('converts day_num to dayNum', () => {
    expect(mapRow({ day_num: 2 }).dayNum).toBe(2);
  });

  it('converts sort_order to sortOrder', () => {
    expect(mapRow({ sort_order: 5 }).sortOrder).toBe(5);
  });

  it('converts trip_id to tripId', () => {
    expect(mapRow({ trip_id: 'okinawa-2026' }).tripId).toBe('okinawa-2026');
  });

  it('converts created_at to createdAt', () => {
    expect(mapRow({ created_at: '2026-01-01' }).createdAt).toBe('2026-01-01');
  });
});

/* ===== JSON_FIELDS parsing — empty after migration 0045 (footer DROP'd) ===== */
describe('mapRow — JSON string fields get parsed', () => {
  // 2026-05-02 (migration 0045): JSON_FIELDS 清空（trips.footer 已 DROP，
  // 其餘 JSON cols 早已改 scalar 或在 API handler 端解析）。保留以下 negative
  // tests 確保未來新增 JSON_FIELDS entry 時 parking / location / 任意 col
  // 沒被誤掃為 JSON。

  it('non-JSON fields are not parsed even if they look like JSON', () => {
    // parking/location/attrs/breakfast 不在 JSON_FIELDS（V2 schema 後皆為 scalar 或 API 解析）
    const result = mapRow({ parking: '{"price":"free"}' });
    expect(result.parking).toBe('{"price":"free"}');
  });

  it('non-JSON_FIELDS string is not parsed', () => {
    const jsonStr = '{"old":"A","new":"B"}';
    const result = mapRow({ diff: jsonStr });
    expect(result.diff).toBe(jsonStr);
  });
});

/* ===== Edge cases ===== */
describe('mapRow — edge cases', () => {
  it('returns null input as-is', () => {
    expect(mapRow(null)).toBeNull();
  });

  it('returns undefined input as-is', () => {
    expect(mapRow(undefined)).toBeUndefined();
  });

  it('returns string input as-is', () => {
    expect(mapRow('hello')).toBe('hello');
  });

  it('returns number input as-is', () => {
    expect(mapRow(42)).toBe(42);
  });

  it('returns empty object for empty input object', () => {
    expect(mapRow({})).toEqual({});
  });

  it('passes through unknown fields unchanged', () => {
    const result = mapRow({ title: '首里城', time: '09:00-11:00', category: '文化' });
    expect(result.title).toBe('首里城');
    expect(result.time).toBe('09:00-11:00');
    expect(result.category).toBe('文化');
  });

  it('passes through null field values unchanged', () => {
    const result = mapRow({ title: null, body: null });
    expect(result.title).toBeNull();
    expect(result.body).toBeNull();
  });

  it('passes through number 0 unchanged', () => {
    const result = mapRow({ rating: 0 });
    expect(result.rating).toBe(0);
  });

  it('ignores inherited prototype properties', () => {
    const proto = { inherited: 'should-be-ignored' };
    const row = Object.create(proto);
    row.title = 'test';
    const result = mapRow(row);
    expect(result.title).toBe('test');
    expect(result.inherited).toBeUndefined();
  });
});

/* ===== mapRows ===== */
describe('mapRows', () => {
  it('maps an array of rows', () => {
    const rows = [
      { sort_order: 1, trip_id: 'a' },
      { sort_order: 2, trip_id: 'b' },
    ];
    const result = mapRows(rows);
    expect(result).toHaveLength(2);
    expect(result[0].sortOrder).toBe(1);
    expect(result[0].tripId).toBe('a');
    expect(result[1].sortOrder).toBe(2);
    expect(result[1].tripId).toBe('b');
  });

  it('returns empty array for non-array input', () => {
    expect(mapRows(null)).toEqual([]);
    expect(mapRows(undefined)).toEqual([]);
    expect(mapRows('string')).toEqual([]);
    expect(mapRows({})).toEqual([]);
  });

  it('returns empty array for empty input array', () => {
    expect(mapRows([])).toEqual([]);
  });

  it('handles mixed rows', () => {
    const rows = [
      { trip_id: 'trip-1', day_num: 1 },
      { trip_id: 'trip-2', day_num: 2 },
    ];
    const result = mapRows(rows);
    expect(result[0].tripId).toBe('trip-1');
    expect(result[0].dayNum).toBe(1);
    expect(result[1].tripId).toBe('trip-2');
    expect(result[1].dayNum).toBe(2);
  });
});

/* ===== Exported constants and functions ===== */
describe('exported constants', () => {
  it('snakeToCamel is a function', () => {
    expect(typeof snakeToCamel).toBe('function');
  });

  it('JSON_FIELDS is an array', () => {
    expect(Array.isArray(JSON_FIELDS)).toBe(true);
  });

  // 2026-05-02 (migration 0045): trips.footer DROP'd → JSON_FIELDS 清空。
  // 不再有 JSON TEXT cols 需要 mapRow 解析（其餘 JSON cols 都改 scalar 或在
  // API handler 端解析）。array 保留為 extension point。
  it('JSON_FIELDS is empty (no JSON TEXT cols left after migration 0045)', () => {
    expect(JSON_FIELDS).toHaveLength(0);
  });
});
