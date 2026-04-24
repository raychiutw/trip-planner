import { describe, it, expect } from 'vitest';
import {
  toTimelineEntry,
  findEntryInDays,
  parseLocalDate,
  formatDateLabel,
} from '../../src/lib/mapDay.ts';

/* ===== buildLocation — 透過 toTimelineEntry 餐廳情境間接測試 ===== */
/* R19 備註：toHotelData 已隨 Hotel card 移除，相關停車場測試改以 toTimelineEntry 測試 */

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
});

describe('buildLocation — maps 非 URL（地名）時 name fallback（R19 後改以 toTimelineEntry 覆蓋）', () => {
  it('餐廳 maps 是地名、name 為空時，location.name 應 fallback 為 maps 值', () => {
    const entry = toTimelineEntry({
      title: '晚餐',
      restaurants: [
        {
          // name 刻意為空 / 未提供
          maps: '北谷町営駐車場 美浜',
        },
      ],
    });
    const restaurant = entry.infoBoxes?.[0]?.restaurants?.[0];
    expect(restaurant).toBeDefined();
    expect(restaurant.location).not.toBeNull();
    // maps 是地名（非 URL），name 應 fallback 為地名
    expect(restaurant.location.name).toBe('北谷町営駐車場 美浜');
    // 非 URL 不應產生 googleQuery
    expect(restaurant.location.googleQuery).toBeUndefined();
  });

  it('餐廳 maps 是地名、name 有值時，location.name 應優先用 name', () => {
    const entry = toTimelineEntry({
      title: '晚餐',
      restaurants: [
        {
          name: '美浜停車場',
          maps: '北谷町営駐車場 美浜',
        },
      ],
    });
    const restaurant = entry.infoBoxes?.[0]?.restaurants?.[0];
    expect(restaurant.location.name).toBe('美浜停車場');
    expect(restaurant.location.googleQuery).toBeUndefined();
  });
});

/* ===== Phase 2 POI JOIN 優先 (v2.1.2.0+) ===== */

describe('toTimelineEntry — entry.poi 優先於 entry 欄位', () => {
  it('entry.poi.maps 存在時，locations 使用 POI maps 而非 entry.maps', () => {
    const entry = toTimelineEntry({
      title: '首里城',
      maps: 'https://legacy.example.com/old',
      poi: {
        id: 42,
        type: 'attraction',
        maps: 'https://www.google.com/maps/search/首里城',
        googleRating: 4.3,
      },
    });
    expect(entry.locations).toHaveLength(1);
    expect(entry.locations[0].googleQuery).toBe('https://www.google.com/maps/search/首里城');
    expect(entry.googleRating).toBe(4.3);
  });

  it('entry.poi 不存在時，fallback 用 entry.maps 與 entry.googleRating', () => {
    const entry = toTimelineEntry({
      title: '舊景點',
      maps: 'https://fallback.example.com',
      googleRating: 4.0,
    });
    expect(entry.locations).toHaveLength(1);
    expect(entry.locations[0].googleQuery).toBe('https://fallback.example.com');
    expect(entry.googleRating).toBe(4.0);
  });

  it('entry.poi.mapcode 存在時使用 POI mapcode', () => {
    const entry = toTimelineEntry({
      title: 'mapcode test',
      mapcode: '11 111 111*11',
      poi: { id: 1, type: 'transport', mapcode: '33 530 406*00' },
    });
    expect(entry.locations[0].mapcode).toBe('33 530 406*00');
  });

  it('entry.poi.maps 與 mapcode 都空時，整個 location block 省略', () => {
    const entry = toTimelineEntry({
      title: '純描述',
      poi: { id: 1, type: 'attraction' },
    });
    expect(entry.locations).toBeNull();
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

/* ===== findEntryInDays — 跨 day 查 entry ===== */

describe('findEntryInDays', () => {
  it('命中時回傳完整 DayEntryContext', () => {
    const days = {
      1: { date: '2026-07-26', label: 'D1 那霸', timeline: [{ id: 42, title: '機場' }] },
    };
    expect(findEntryInDays(days, 42)).toEqual({
      entry: { id: 42, title: '機場' },
      dayNum: 1,
      date: '2026-07-26',
      label: 'D1 那霸',
    });
  });

  it('未命中時回傳 null', () => {
    expect(findEntryInDays({ 1: { timeline: [{ id: 1 }] } }, 99)).toBeNull();
  });

  it('空 days 物件回傳 null', () => {
    expect(findEntryInDays({}, 1)).toBeNull();
  });

  it('day 無 timeline 跳過', () => {
    expect(findEntryInDays({ 1: { label: 'empty' } }, 1)).toBeNull();
  });

  it('date/label 未定義時 context 以 null 填入', () => {
    const ctx = findEntryInDays({ 1: { timeline: [{ id: 1 }] } }, 1);
    expect(ctx).toMatchObject({ date: null, label: null });
  });

  it('非 finite entryId 直接回傳 null', () => {
    const days = { 1: { timeline: [{ id: 1 }] } };
    expect(findEntryInDays(days, NaN)).toBeNull();
    expect(findEntryInDays(days, Infinity)).toBeNull();
  });

  it('跨多天搜尋時回傳正確的 dayNum', () => {
    const days = {
      1: { date: '2026-07-26', timeline: [{ id: 1 }] },
      2: { date: '2026-07-27', timeline: [{ id: 2 }, { id: 3 }] },
      3: { date: '2026-07-28', timeline: [{ id: 4 }] },
    };
    expect(findEntryInDays(days, 3)?.dayNum).toBe(2);
    expect(findEntryInDays(days, 4)?.dayNum).toBe(3);
  });
});

/* ===== parseLocalDate — 本地時區 YYYY-MM-DD 解析 ===== */

describe('parseLocalDate', () => {
  it('null/undefined/空字串回傳 null', () => {
    expect(parseLocalDate(null)).toBeNull();
    expect(parseLocalDate(undefined)).toBeNull();
    expect(parseLocalDate('')).toBeNull();
  });

  it('合法 YYYY-MM-DD 解析為本地午夜', () => {
    const d = parseLocalDate('2026-07-26');
    expect(d).not.toBeNull();
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // 0-indexed
    expect(d.getDate()).toBe(26);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('非法日期字串回傳 null', () => {
    expect(parseLocalDate('not-a-date')).toBeNull();
    expect(parseLocalDate('2026-13-45')).toBeNull();
  });

  it('拒絕月日溢位（2026-02-30 不應被接受成 3/2）', () => {
    expect(parseLocalDate('2026-02-30')).toBeNull();
    expect(parseLocalDate('2026-04-31')).toBeNull();
    expect(parseLocalDate('2026-13-01')).toBeNull();
  });

  it('拒絕非 YYYY-MM-DD 格式', () => {
    expect(parseLocalDate('26-07-26')).toBeNull();
    expect(parseLocalDate('2026/07/26')).toBeNull();
    expect(parseLocalDate('2026-7-26')).toBeNull();
  });
});

/* ===== formatDateLabel — M/D 顯示 ===== */

describe('formatDateLabel', () => {
  it('null/undefined/空字串回傳空字串', () => {
    expect(formatDateLabel(null)).toBe('');
    expect(formatDateLabel(undefined)).toBe('');
    expect(formatDateLabel('')).toBe('');
  });

  it('合法日期輸出 M/D 無補零', () => {
    expect(formatDateLabel('2026-07-26')).toBe('7/26');
    expect(formatDateLabel('2026-01-05')).toBe('1/5');
    expect(formatDateLabel('2026-12-31')).toBe('12/31');
  });

  it('非法輸入回傳空字串', () => {
    expect(formatDateLabel('abc')).toBe('');
    expect(formatDateLabel('2026/07/26')).toBe('');
  });
});
