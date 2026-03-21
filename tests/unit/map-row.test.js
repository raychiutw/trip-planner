import { describe, it, expect } from 'vitest';
import { mapRow, mapRows, FIELD_MAP, JSON_FIELDS } from '../../src/lib/mapRow.ts';

/* ===== FIELD_MAP renames ===== */
describe('mapRow — FIELD_MAP renames', () => {
  it('renames body to description', () => {
    expect(mapRow({ body: '描述文字' }).description).toBe('描述文字');
  });

  it('renames rating to googleRating', () => {
    expect(mapRow({ rating: 4.5 }).googleRating).toBe(4.5);
  });

  it('renames must_buy to mustBuy', () => {
    expect(mapRow({ must_buy: '泡盛' }).mustBuy).toBe('泡盛');
  });

  it('renames reservation_url to reservationUrl', () => {
    expect(mapRow({ reservation_url: 'https://example.com' }).reservationUrl).toBe('https://example.com');
  });

  it('renames day_of_week to dayOfWeek', () => {
    expect(mapRow({ day_of_week: '三' }).dayOfWeek).toBe('三');
  });

  it('renames self_drive to selfDrive', () => {
    expect(mapRow({ self_drive: 1 }).selfDrive).toBe(1);
  });

  it('renames og_description to ogDescription', () => {
    expect(mapRow({ og_description: '沖繩行程' }).ogDescription).toBe('沖繩行程');
  });

  it('renames day_num to dayNum', () => {
    expect(mapRow({ day_num: 2 }).dayNum).toBe(2);
  });

  it('renames sort_order to sortOrder', () => {
    expect(mapRow({ sort_order: 5 }).sortOrder).toBe(5);
  });

  it('renames parent_type to parentType', () => {
    expect(mapRow({ parent_type: 'entry' }).parentType).toBe('entry');
  });

  it('renames parent_id to parentId', () => {
    expect(mapRow({ parent_id: 42 }).parentId).toBe(42);
  });

  it('renames entry_id to entryId', () => {
    expect(mapRow({ entry_id: 7 }).entryId).toBe(7);
  });

  it('renames trip_id to tripId', () => {
    expect(mapRow({ trip_id: 'okinawa-2026' }).tripId).toBe('okinawa-2026');
  });

  it('renames doc_type to docType', () => {
    expect(mapRow({ doc_type: 'checklist' }).docType).toBe('checklist');
  });

  it('renames created_at to createdAt', () => {
    expect(mapRow({ created_at: '2026-01-01' }).createdAt).toBe('2026-01-01');
  });

  it('renames updated_at to updatedAt', () => {
    expect(mapRow({ updated_at: '2026-01-02' }).updatedAt).toBe('2026-01-02');
  });

  it('renames submitted_by to submittedBy', () => {
    expect(mapRow({ submitted_by: 'Ray' }).submittedBy).toBe('Ray');
  });

  it('renames changed_by to changedBy', () => {
    expect(mapRow({ changed_by: 'HuiYun' }).changedBy).toBe('HuiYun');
  });

  it('renames table_name to tableName', () => {
    expect(mapRow({ table_name: 'trip_days' }).tableName).toBe('trip_days');
  });

  it('renames record_id to recordId', () => {
    expect(mapRow({ record_id: 99 }).recordId).toBe(99);
  });

  it('renames request_id to requestId', () => {
    expect(mapRow({ request_id: 'req-123' }).requestId).toBe('req-123');
  });

  it('renames food_prefs to foodPrefs', () => {
    expect(mapRow({ food_prefs: '無辣' }).foodPrefs).toBe('無辣');
  });

  it('renames auto_scroll to autoScroll', () => {
    expect(mapRow({ auto_scroll: '2026-05-01,2026-05-02' }).autoScroll).toBe('2026-05-01,2026-05-02');
  });
});

/* ===== JSON_FIELDS parsing ===== */
describe('mapRow — JSON string fields get parsed', () => {
  it('parses weather_json string to object and strips _json suffix', () => {
    const result = mapRow({ weather_json: '{"condition":"sunny","temp":"28"}' });
    expect(result.weather).toEqual({ condition: 'sunny', temp: '28' });
    expect(result.weather_json).toBeUndefined();
  });

  it('passes weather_json already as object through and strips suffix', () => {
    const obj = { condition: 'cloudy' };
    const result = mapRow({ weather_json: obj });
    expect(result.weather).toBe(obj);
  });

  it('parses parking_json string to object and strips suffix', () => {
    const result = mapRow({ parking_json: '{"price":"免費","note":"B1"}' });
    expect(result.parking).toEqual({ price: '免費', note: 'B1' });
    expect(result.parking_json).toBeUndefined();
  });

  it('parses footer_json string to object and strips suffix', () => {
    const result = mapRow({ footer_json: '{"dates":"2026-05-01 ~ 2026-05-05"}' });
    expect(result.footer).toEqual({ dates: '2026-05-01 ~ 2026-05-05' });
    expect(result.footer_json).toBeUndefined();
  });

  it('parses location_json string to object and strips suffix', () => {
    const result = mapRow({ location_json: '{"name":"首里城","googleQuery":"https://maps.google.com/q=test"}' });
    expect(result.location).toEqual({ name: '首里城', googleQuery: 'https://maps.google.com/q=test' });
    expect(result.location_json).toBeUndefined();
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

  it('keeps malformed JSON string as-is', () => {
    const result = mapRow({ weather_json: '{not json}' });
    expect(result.weather).toBe('{not json}');
  });

  it('diff_json strips _json suffix to diff (not parsed, not in JSON_FIELDS)', () => {
    const jsonStr = '{"old":"A","new":"B"}';
    const result = mapRow({ diff_json: jsonStr });
    // _json suffix is stripped: 'diff_json' → 'diff'
    // FIELD_MAP['diff'] is undefined, so key stays 'diff'
    // diff_json is not in JSON_FIELDS so val is NOT parsed
    expect(result.diff).toBe(jsonStr);
    expect(result.diff_json).toBeUndefined();
  });
});

/* ===== _json suffix stripping ===== */
describe('mapRow — _json suffix removal', () => {
  it('strips _json suffix from any field (not just JSON_FIELDS)', () => {
    const result = mapRow({ custom_json: 'value' });
    expect(result.custom).toBe('value');
    expect(result.custom_json).toBeUndefined();
  });

  it('does not strip _json from middle of key name', () => {
    const result = mapRow({ json_data: 'x' });
    expect(result.json_data).toBe('x');
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
    expect(result.description).toBeNull();
  });

  it('passes through number 0 unchanged', () => {
    const result = mapRow({ rating: 0 });
    expect(result.googleRating).toBe(0);
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
      { body: 'desc A', rating: 4.5 },
      { body: 'desc B', rating: 3.8 },
    ];
    const result = mapRows(rows);
    expect(result).toHaveLength(2);
    expect(result[0].description).toBe('desc A');
    expect(result[0].googleRating).toBe(4.5);
    expect(result[1].description).toBe('desc B');
    expect(result[1].googleRating).toBe(3.8);
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

/* ===== FIELD_MAP and JSON_FIELDS exports ===== */
describe('exported constants', () => {
  it('FIELD_MAP is an object', () => {
    expect(typeof FIELD_MAP).toBe('object');
    expect(FIELD_MAP).not.toBeNull();
  });

  it('JSON_FIELDS is an array', () => {
    expect(Array.isArray(JSON_FIELDS)).toBe(true);
  });

  it('JSON_FIELDS contains expected fields', () => {
    expect(JSON_FIELDS).toContain('weather_json');
    expect(JSON_FIELDS).toContain('parking_json');
    expect(JSON_FIELDS).toContain('footer_json');
    expect(JSON_FIELDS).toContain('location_json');
    expect(JSON_FIELDS).toContain('breakfast');
  });
});
