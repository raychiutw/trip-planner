import { describe, it, expect } from 'vitest';

const {
  tryParseJson,
  buildLocationFromMaps,
  mapApiDay,
  mapApiMeta,
} = require('../../js/app.js');

/* ===== tryParseJson ===== */
describe('tryParseJson', () => {
  it('returns parsed object from JSON string', () => {
    const result = tryParseJson('{"key":"value","num":42}');
    expect(result).toEqual({ key: 'value', num: 42 });
  });

  it('returns parsed array from JSON array string', () => {
    const result = tryParseJson('["a","b","c"]');
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('returns object as-is if already an object', () => {
    const obj = { key: 'value' };
    expect(tryParseJson(obj)).toBe(obj);
  });

  it('returns array as-is if already an array', () => {
    const arr = [1, 2, 3];
    expect(tryParseJson(arr)).toBe(arr);
  });

  it('returns null as-is', () => {
    expect(tryParseJson(null)).toBeNull();
  });

  it('returns undefined as-is', () => {
    expect(tryParseJson(undefined)).toBeUndefined();
  });

  it('returns non-JSON string as-is', () => {
    expect(tryParseJson('plain text')).toBe('plain text');
  });

  it('returns malformed JSON string as-is', () => {
    expect(tryParseJson('{not json}')).toBe('{not json}');
  });

  it('returns empty string as-is (falsy)', () => {
    expect(tryParseJson('')).toBe('');
  });

  it('returns number as-is', () => {
    expect(tryParseJson(42)).toBe(42);
  });
});

/* ===== buildLocationFromMaps ===== */
describe('buildLocationFromMaps', () => {
  it('builds location with googleQuery and appleQuery URLs from maps string', () => {
    const loc = buildLocationFromMaps('首里城公園');
    expect(loc).not.toBeNull();
    expect(loc.googleQuery).toContain('google.com/maps/search/');
    expect(loc.googleQuery).toContain(encodeURIComponent('首里城公園'));
    expect(loc.appleQuery).toContain('maps.apple.com');
    expect(loc.appleQuery).toContain(encodeURIComponent('首里城公園'));
  });

  it('sets name from maps string', () => {
    const loc = buildLocationFromMaps('那霸機場');
    expect(loc.name).toBe('那霸機場');
  });

  it('trims whitespace from maps string', () => {
    const loc = buildLocationFromMaps('  首里城  ');
    expect(loc.name).toBe('首里城');
  });

  it('includes mapcode when provided', () => {
    const loc = buildLocationFromMaps('首里城公園', '33 161 526*53');
    expect(loc.mapcode).toBe('33 161 526*53');
  });

  it('does not include mapcode property when not provided', () => {
    const loc = buildLocationFromMaps('首里城公園');
    expect(loc.mapcode).toBeUndefined();
  });

  it('returns null when no maps string', () => {
    expect(buildLocationFromMaps(null)).toBeNull();
    expect(buildLocationFromMaps(undefined)).toBeNull();
    expect(buildLocationFromMaps('')).toBeNull();
  });

  it('uses google/maps/search path in googleQuery', () => {
    const loc = buildLocationFromMaps('テスト');
    expect(loc.googleQuery).toContain('/maps/search/');
  });
});

/* ===== mapApiMeta ===== */
describe('mapApiMeta', () => {
  it('parses footer_json from string to object', () => {
    const result = mapApiMeta({
      footer_json: '{"dates":"2026-05-01 ~ 2026-05-05","note":"test"}'
    });
    expect(result.footer).toEqual({ dates: '2026-05-01 ~ 2026-05-05', note: 'test' });
  });

  it('handles footer_json already as object', () => {
    const footerObj = { dates: '2026-05-01 ~ 2026-05-05' };
    const result = mapApiMeta({ footer_json: footerObj });
    expect(result.footer).toEqual(footerObj);
  });

  it('returns empty footer object when footer_json is absent', () => {
    const result = mapApiMeta({});
    expect(result.footer).toEqual({});
  });

  it('parses auto_scroll comma-separated string to array', () => {
    const result = mapApiMeta({ auto_scroll: '2026-05-01, 2026-05-02, 2026-05-03' });
    expect(result.autoScrollDates).toEqual(['2026-05-01', '2026-05-02', '2026-05-03']);
  });

  it('handles auto_scroll as JSON array string', () => {
    const result = mapApiMeta({ auto_scroll: '["2026-05-01","2026-05-02"]' });
    expect(result.autoScrollDates).toEqual(['2026-05-01', '2026-05-02']);
  });

  it('handles auto_scroll already as array', () => {
    const result = mapApiMeta({ auto_scroll: ['2026-05-01', '2026-05-02'] });
    expect(result.autoScrollDates).toEqual(['2026-05-01', '2026-05-02']);
  });

  it('returns null autoScrollDates when auto_scroll is absent', () => {
    const result = mapApiMeta({});
    expect(result.autoScrollDates).toBeNull();
  });

  it('maps og_description to ogDescription', () => {
    const result = mapApiMeta({ og_description: '沖繩五天行程' });
    expect(result.meta.ogDescription).toBe('沖繩五天行程');
  });

  it('maps self_drive to selfDrive (boolean true)', () => {
    const result = mapApiMeta({ self_drive: 1 });
    expect(result.meta.selfDrive).toBe(true);
  });

  it('maps self_drive to selfDrive (boolean false)', () => {
    const result = mapApiMeta({ self_drive: 0 });
    expect(result.meta.selfDrive).toBe(false);
  });

  it('maps selfDrive field as well', () => {
    const result = mapApiMeta({ selfDrive: true });
    expect(result.meta.selfDrive).toBe(true);
  });

  it('parses countries string to single-element array', () => {
    const result = mapApiMeta({ countries: 'Japan' });
    expect(result.meta.countries).toEqual(['Japan']);
  });

  it('parses countries JSON array string', () => {
    const result = mapApiMeta({ countries: '["Japan","Taiwan"]' });
    expect(result.meta.countries).toEqual(['Japan', 'Taiwan']);
  });

  it('passes countries array through unchanged', () => {
    const result = mapApiMeta({ countries: ['Japan', 'Taiwan'] });
    expect(result.meta.countries).toEqual(['Japan', 'Taiwan']);
  });

  it('returns empty countries array when absent', () => {
    const result = mapApiMeta({});
    expect(result.meta.countries).toEqual([]);
  });

  it('maps title to meta.title', () => {
    const result = mapApiMeta({ title: '沖繩行程', name: '沖繩' });
    expect(result.meta.title).toBe('沖繩行程');
  });

  it('falls back to name when title is absent', () => {
    const result = mapApiMeta({ name: '沖繩行程' });
    expect(result.meta.title).toBe('沖繩行程');
  });
});

/* ===== mapApiDay — hotel mapping ===== */
describe('mapApiDay — hotel mapping', () => {
  it('parses breakfast JSON string to object', () => {
    const result = mapApiDay({
      day_num: 1,
      hotel: { name: 'Hotel A', breakfast: '{"included":true,"time":"07:00-10:00"}' }
    });
    expect(result.content.hotel.breakfast).toEqual({ included: true, time: '07:00-10:00' });
  });

  it('parses parking_json to parking object', () => {
    const result = mapApiDay({
      day_num: 1,
      hotel: { name: 'Hotel A', parking_json: '{"price":"免費","note":"B1"}' }
    });
    expect(result.content.hotel.parking).toEqual({ price: '免費', note: 'B1' });
  });

  it('splits details comma-separated string to array', () => {
    const result = mapApiDay({
      day_num: 1,
      hotel: { name: 'Hotel A', details: 'Check-in 15:00, Check-out 11:00, 含早餐' }
    });
    expect(result.content.hotel.details).toEqual(['Check-in 15:00', 'Check-out 11:00', '含早餐']);
  });

  it('keeps details as array if already array', () => {
    const arr = ['Check-in 15:00'];
    const result = mapApiDay({
      day_num: 1,
      hotel: { name: 'Hotel A', details: arr }
    });
    expect(result.content.hotel.details).toBe(arr);
  });

  it('builds parking infoBox from parking data', () => {
    const result = mapApiDay({
      day_num: 1,
      hotel: {
        name: 'Hotel A',
        parking_json: '{"price":"¥500/日","maps":"Hotel Parking"}'
      }
    });
    const infoBoxes = result.content.hotel.infoBoxes;
    expect(infoBoxes).toBeDefined();
    const parkingBox = infoBoxes.find(function(b) { return b.type === 'parking'; });
    expect(parkingBox).toBeDefined();
    expect(parkingBox.price).toBe('¥500/日');
  });

  it('builds parking infoBox location from maps', () => {
    const result = mapApiDay({
      day_num: 1,
      hotel: {
        name: 'Hotel A',
        parking_json: '{"price":"免費","maps":"那霸飯店停車場","mapcode":"33 000 000*11"}'
      }
    });
    const parkingBox = result.content.hotel.infoBoxes.find(function(b) { return b.type === 'parking'; });
    expect(parkingBox.location).not.toBeNull();
    expect(parkingBox.location.googleQuery).toContain(encodeURIComponent('那霸飯店停車場'));
    expect(parkingBox.location.mapcode).toBe('33 000 000*11');
  });

  it('builds shopping infoBox from hotel shopping array', () => {
    const result = mapApiDay({
      day_num: 1,
      hotel: {
        name: 'Hotel A',
        shopping: [{ name: 'DFS', category: '免稅店' }]
      }
    });
    const infoBoxes = result.content.hotel.infoBoxes;
    const shoppingBox = infoBoxes.find(function(b) { return b.type === 'shopping'; });
    expect(shoppingBox).toBeDefined();
    expect(shoppingBox.shops[0].name).toBe('DFS');
  });

  it('maps shopping rating to googleRating', () => {
    const result = mapApiDay({
      day_num: 1,
      hotel: {
        name: 'Hotel A',
        shopping: [{ name: 'MaxValu', rating: 4.1 }]
      }
    });
    expect(result.content.hotel.shopping[0].googleRating).toBe(4.1);
  });

  it('maps shopping must_buy string to mustBuy array', () => {
    const result = mapApiDay({
      day_num: 1,
      hotel: {
        name: 'Hotel A',
        shopping: [{ name: 'MaxValu', must_buy: '泡盛, 黑糖, 海鹽' }]
      }
    });
    expect(result.content.hotel.shopping[0].mustBuy).toEqual(['泡盛', '黑糖', '海鹽']);
  });

  it('builds shopping location from maps/mapcode', () => {
    const result = mapApiDay({
      day_num: 1,
      hotel: {
        name: 'Hotel A',
        shopping: [{ name: 'San-A', maps: 'サンエー那覇メインプレイス', mapcode: '33 157 382*24' }]
      }
    });
    const shop = result.content.hotel.shopping[0];
    expect(shop.location).toBeDefined();
    expect(shop.location.googleQuery).toContain(encodeURIComponent('サンエー那覇メインプレイス'));
    expect(shop.location.mapcode).toBe('33 157 382*24');
  });

  it('does not add infoBoxes when hotel has no parking or shopping', () => {
    const result = mapApiDay({
      day_num: 1,
      hotel: { name: 'Hotel A' }
    });
    expect(result.content.hotel.infoBoxes).toBeUndefined();
  });

  it('handles null hotel gracefully', () => {
    const result = mapApiDay({ day_num: 1, hotel: null });
    expect(result.content.hotel).toBeNull();
  });
});

/* ===== mapApiDay — entry mapping ===== */
describe('mapApiDay — entry mapping', () => {
  it('maps body to description', () => {
    const result = mapApiDay({
      day_num: 1,
      timeline: [{ title: '首里城', body: '琉球王朝的象徵' }]
    });
    expect(result.content.timeline[0].description).toBe('琉球王朝的象徵');
  });

  it('maps rating to googleRating', () => {
    const result = mapApiDay({
      day_num: 1,
      timeline: [{ title: '首里城', rating: 4.5 }]
    });
    expect(result.content.timeline[0].googleRating).toBe(4.5);
  });

  it('maps travel desc to travel.text', () => {
    const result = mapApiDay({
      day_num: 1,
      timeline: [{ title: 'A', travel: { type: 'car', desc: '車程約 30 分', min: 30 } }]
    });
    expect(result.content.timeline[0].travel.text).toBe('車程約 30 分');
  });

  it('parses location_json to locations array (array)', () => {
    const result = mapApiDay({
      day_num: 1,
      timeline: [{ title: '景點', location_json: '[{"name":"首里城","googleQuery":"https://maps.google.com/q=test"}]' }]
    });
    expect(result.content.timeline[0].locations).toHaveLength(1);
    expect(result.content.timeline[0].locations[0].name).toBe('首里城');
  });

  it('parses location_json object to single-element locations array', () => {
    const result = mapApiDay({
      day_num: 1,
      timeline: [{ title: '景點', location_json: '{"name":"首里城","googleQuery":"https://maps.google.com/q=test"}' }]
    });
    expect(result.content.timeline[0].locations).toHaveLength(1);
  });

  it('falls back to buildLocationFromMaps when location_json is null but maps exists', () => {
    const result = mapApiDay({
      day_num: 1,
      timeline: [{ title: '景點', location_json: null, maps: '首里城公園', mapcode: '33 161 526*53' }]
    });
    expect(result.content.timeline[0].locations).toHaveLength(1);
    expect(result.content.timeline[0].locations[0].mapcode).toBe('33 161 526*53');
  });

  it('builds restaurants infoBox', () => {
    const result = mapApiDay({
      day_num: 1,
      timeline: [{
        title: '午餐',
        restaurants: [{ name: '沖繩そば', category: '麵類' }]
      }]
    });
    const infoBoxes = result.content.timeline[0].infoBoxes;
    expect(infoBoxes).toBeDefined();
    const rBox = infoBoxes.find(function(b) { return b.type === 'restaurants'; });
    expect(rBox).toBeDefined();
    expect(rBox.restaurants[0].name).toBe('沖繩そば');
  });

  it('builds shopping infoBox', () => {
    const result = mapApiDay({
      day_num: 1,
      timeline: [{
        title: '購物',
        shopping: [{ name: 'San-A' }]
      }]
    });
    const infoBoxes = result.content.timeline[0].infoBoxes;
    const sBox = infoBoxes.find(function(b) { return b.type === 'shopping'; });
    expect(sBox).toBeDefined();
  });

  it('maps restaurant rating to googleRating', () => {
    const result = mapApiDay({
      day_num: 1,
      timeline: [{
        title: '午餐',
        restaurants: [{ name: 'そば店', rating: 4.3 }]
      }]
    });
    expect(result.content.timeline[0].restaurants[0].googleRating).toBe(4.3);
  });

  it('maps restaurant maps to location with googleQuery/appleQuery', () => {
    const result = mapApiDay({
      day_num: 1,
      timeline: [{
        title: '午餐',
        restaurants: [{ name: 'そば店', maps: 'そば店那覇' }]
      }]
    });
    const restaurant = result.content.timeline[0].restaurants[0];
    expect(restaurant.location).toBeDefined();
    expect(restaurant.location.googleQuery).toContain('google.com/maps/search/');
    expect(restaurant.location.appleQuery).toContain('maps.apple.com');
  });

  it('maps restaurant reservation_url to reservationUrl', () => {
    const result = mapApiDay({
      day_num: 1,
      timeline: [{
        title: '晚餐',
        restaurants: [{ name: '燒肉', reservation_url: 'https://reserve.example.com' }]
      }]
    });
    expect(result.content.timeline[0].restaurants[0].reservationUrl).toBe('https://reserve.example.com');
  });

  it('maps shopping must_buy string to mustBuy array split by ", "', () => {
    const result = mapApiDay({
      day_num: 1,
      timeline: [{
        title: '購物',
        shopping: [{ name: 'MaxValu', must_buy: '泡盛, 黑糖, 紅芋塔' }]
      }]
    });
    expect(result.content.timeline[0].shopping[0].mustBuy).toEqual(['泡盛', '黑糖', '紅芋塔']);
  });

  it('does not add infoBoxes when no restaurants or shopping', () => {
    const result = mapApiDay({
      day_num: 1,
      timeline: [{ title: '景點' }]
    });
    expect(result.content.timeline[0].infoBoxes).toBeUndefined();
  });
});

/* ===== mapApiDay — overall structure ===== */
describe('mapApiDay — overall structure', () => {
  it('returns { id, date, dayOfWeek, label, weather, content: { hotel, timeline } }', () => {
    const result = mapApiDay({
      day_num: 2,
      date: '2026-05-02',
      day_of_week: '六',
      label: '那霸市區',
      weather_json: '{"condition":"sunny","temp":"28"}',
      hotel: null,
      timeline: []
    });
    expect(result).toMatchObject({
      id: 2,
      date: '2026-05-02',
      dayOfWeek: '六',
      label: '那霸市區',
      content: { hotel: null, timeline: [] }
    });
    expect(result.weather).toEqual({ condition: 'sunny', temp: '28' });
  });

  it('maps day_num to id', () => {
    const result = mapApiDay({ day_num: 3 });
    expect(result.id).toBe(3);
  });

  it('falls back to raw.id when day_num is null', () => {
    const result = mapApiDay({ id: 5, day_num: null });
    expect(result.id).toBe(5);
  });

  it('maps day_of_week to dayOfWeek', () => {
    const result = mapApiDay({ day_of_week: '日' });
    expect(result.dayOfWeek).toBe('日');
  });

  it('falls back to raw.dayOfWeek when day_of_week is absent', () => {
    const result = mapApiDay({ dayOfWeek: '一' });
    expect(result.dayOfWeek).toBe('一');
  });

  it('parses weather_json', () => {
    const result = mapApiDay({ weather_json: '{"icon":"sunny","temp":"28"}' });
    expect(result.weather).toEqual({ icon: 'sunny', temp: '28' });
  });

  it('uses weather object directly when weather_json is absent', () => {
    const weatherObj = { icon: 'cloudy', temp: '25' };
    const result = mapApiDay({ weather: weatherObj });
    expect(result.weather).toBe(weatherObj);
  });

  it('returns null weather when neither weather_json nor weather provided', () => {
    const result = mapApiDay({});
    expect(result.weather).toBeNull();
  });

  it('handles empty timeline gracefully', () => {
    const result = mapApiDay({ day_num: 1 });
    expect(result.content.timeline).toEqual([]);
  });
});

/* ===== docs unwrapping logic ===== */
describe('docs content unwrapping', () => {
  // This tests the logic from loadTrip (app.js lines ~1121-1131):
  // content string → parse
  // { title, content: { cards } } → unwrap to { cards, _title }
  // simple object without .content → pass through

  function unwrapDocContent(rawContent) {
    var content = rawContent;
    if (typeof content === 'string') {
      try { content = JSON.parse(content); } catch (e) {}
    }
    if (content && content.content) {
      var docTitle = content.title;
      content = content.content;
      content._title = docTitle;
    }
    return content;
  }

  it('parses content string to object', () => {
    const result = unwrapDocContent('{"cards":[{"title":"T"}]}');
    expect(result).toEqual({ cards: [{ title: 'T' }] });
  });

  it('unwraps nested { title, content: { cards } } to { cards, _title }', () => {
    const raw = { title: '行前準備', content: { cards: [{ title: '證件' }] } };
    const result = unwrapDocContent(raw);
    expect(result.cards).toEqual([{ title: '證件' }]);
    expect(result._title).toBe('行前準備');
  });

  it('passes through simple object without .content', () => {
    const raw = { cards: [{ title: '備案' }] };
    const result = unwrapDocContent(raw);
    expect(result).toBe(raw);
  });

  it('parses JSON string with nested structure and unwraps', () => {
    const jsonStr = JSON.stringify({
      title: '緊急聯絡',
      content: { cards: [{ title: '警察', contacts: [] }] }
    });
    const result = unwrapDocContent(jsonStr);
    expect(result._title).toBe('緊急聯絡');
    expect(result.cards).toHaveLength(1);
  });

  it('returns non-JSON string as-is', () => {
    const result = unwrapDocContent('not json');
    expect(result).toBe('not json');
  });

  it('handles null gracefully', () => {
    const result = unwrapDocContent(null);
    expect(result).toBeNull();
  });
});
