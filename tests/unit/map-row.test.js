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

  it('converts self_drive to selfDrive', () => {
    expect(mapRow({ self_drive: 1 }).selfDrive).toBe(1);
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

/* ===== JSON_FIELDS parsing (DB 欄位不再有 _json 後綴) ===== */
describe('mapRow — JSON string fields get parsed', () => {
  it('parses parking string to object', () => {
    const result = mapRow({ parking: '{"price":"免費","note":"B1"}' });
    expect(result.parking).toEqual({ price: '免費', note: 'B1' });
  });

  it('parses footer string to object', () => {
    const result = mapRow({ footer: '{"dates":"2026-05-01 ~ 2026-05-05"}' });
    expect(result.footer).toEqual({ dates: '2026-05-01 ~ 2026-05-05' });
  });

  it('parses location string to object', () => {
    const result = mapRow({ location: '{"name":"首里城","googleQuery":"https://maps.google.com/q=test"}' });
    expect(result.location).toEqual({ name: '首里城', googleQuery: 'https://maps.google.com/q=test' });
  });

  it('parses breakfast string to object', () => {
    const result = mapRow({ breakfast: '{"included":true,"time":"07:00-10:00"}' });
    expect(result.breakfast).toEqual({ included: true, time: '07:00-10:00' });
  });

  it('passes breakfast already as object through unchanged', () => {
    const obj = { included: false };
    const result = mapRow({ breakfast: obj });
    expect(result.breakfast).toBe(obj);
  });

  it('parses attrs string to object', () => {
    const result = mapRow({ attrs: '{"checkout":"11:00"}' });
    expect(result.attrs).toEqual({ checkout: '11:00' });
  });

  it('parses trip_attrs string to object', () => {
    const result = mapRow({ trip_attrs: '{"reservation":"已訂位"}' });
    expect(result.tripAttrs).toEqual({ reservation: '已訂位' });
  });

  it('keeps malformed JSON string as-is', () => {
    const result = mapRow({ parking: '{not json}' });
    expect(result.parking).toBe('{not json}');
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

  it('JSON_FIELDS contains expected fields', () => {
    // weather removed — derived at runtime from entries
    expect(JSON_FIELDS).toContain('parking');
    expect(JSON_FIELDS).toContain('footer');
    expect(JSON_FIELDS).toContain('location');
    expect(JSON_FIELDS).toContain('attrs');
    expect(JSON_FIELDS).toContain('trip_attrs');
    expect(JSON_FIELDS).toContain('breakfast');
  });
});
