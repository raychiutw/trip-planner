import { describe, it, expect } from 'vitest';
import { toHotelData, toTimelineEntry } from '../../src/lib/mapDay.ts';

/* ===== buildLocation（透過 toHotelData 停車場情境間接測試）===== */

describe('buildLocation — maps 非 URL（地名）時 name fallback', () => {
  it('停車場 maps 是地名時，location.name 應為地名而非空', () => {
    const hotel = toHotelData({
      name: 'Hotel A',
      parking: { maps: '北谷町営駐車場 美浜', price: '免費' },
    });
    const parking = hotel.infoBoxes?.find((b) => b.type === 'parking');
    expect(parking).toBeDefined();
    expect(parking.location).not.toBeNull();
    // maps 是地名（非 URL），name 應 fallback 為地名
    expect(parking.location.name).toBe('北谷町営駐車場 美浜');
    // 非 URL 不應產生 googleQuery
    expect(parking.location.googleQuery).toBeUndefined();
  });

  it('停車場 maps 是地名但 parking.name 有值時，location.name 應為 parking.name', () => {
    const hotel = toHotelData({
      name: 'Hotel A',
      parking: { maps: '北谷町営駐車場 美浜', name: '美浜停車場', price: '免費' },
    });
    const parking = hotel.infoBoxes?.find((b) => b.type === 'parking');
    expect(parking.location.name).toBe('美浜停車場');
    expect(parking.location.googleQuery).toBeUndefined();
  });
});

describe('buildLocation — maps 是 URL 時 googleQuery', () => {
  it('餐廳 maps 是 URL 時，location.googleQuery 應為該 URL', () => {
    const entry = toTimelineEntry({
      title: '午餐',
      restaurants: [
        {
          name: '沖繩そば',
          maps: 'https://maps.google.com/?q=%E6%B2%96%E7%B8%84',
        },
      ],
    });
    const restaurant = entry.infoBoxes?.[0]?.restaurants?.[0];
    expect(restaurant).toBeDefined();
    expect(restaurant.location).not.toBeNull();
    expect(restaurant.location.googleQuery).toBe('https://maps.google.com/?q=%E6%B2%96%E7%B8%84');
    // URL 模式時，name 不使用 maps 欄位
    expect(restaurant.location.name).toBe('沖繩そば');
  });

  it('停車場 maps 是 URL 時，location.googleQuery 應為該 URL', () => {
    const hotel = toHotelData({
      name: 'Hotel A',
      parking: { maps: 'https://maps.google.com/?q=parking', price: '¥500' },
    });
    const parking = hotel.infoBoxes?.find((b) => b.type === 'parking');
    expect(parking.location.googleQuery).toBe('https://maps.google.com/?q=parking');
    // URL 模式時，maps 不作為 name
    expect(parking.location.name).toBeUndefined();
  });
});

/* ===== URL trip 參數優先權（使用 jsdom window.location）===== */

describe('URL trip 參數優先順序邏輯', () => {
  it('URLSearchParams 能正確取得 ?trip= 參數', () => {
    // 模擬 getUrlTrip() 的等效邏輯（new URLSearchParams(search).get('trip')）
    const search = '?trip=okinawa-trip-2026-Ray&day=1';
    const tripId = new URLSearchParams(search).get('trip');
    expect(tripId).toBe('okinawa-trip-2026-Ray');
  });

  it('URL 無 trip 參數時 URLSearchParams 回傳 null', () => {
    const search = '?day=1';
    const tripId = new URLSearchParams(search).get('trip');
    expect(tripId).toBeNull();
  });

  it('URL trip 參數格式驗證：合法 ID 應通過 /^[\\w-]+$/ 檢查', () => {
    const validId = 'okinawa-trip-2026-Ray';
    expect(/^[\w-]+$/.test(validId)).toBe(true);
  });

  it('URL trip 參數格式驗證：含特殊字元的 ID 應被拒絕', () => {
    const invalidId = '../etc/passwd';
    expect(/^[\w-]+$/.test(invalidId)).toBe(false);
  });

  it('空字串 trip 應 fallback 到 localStorage', () => {
    const tripId = '';
    // 邏輯：!tripId || !/^[\w-]+$/.test(tripId) → 使用 localStorage
    const shouldUseLs = !tripId || !/^[\w-]+$/.test(tripId);
    expect(shouldUseLs).toBe(true);
  });
});
