/**
 * Unit tests for useMapData hook
 *
 * 測試：
 *   1. 空 day → 回傳空陣列
 *   2. 有效 entry lat/lng → 回傳 MapPin
 *   3. 無效 lat/lng (0/null/undefined) → missingCount++
 *   4. hotel 有座標 → 加入 hotel pin (index=0)
 *   5. hotel 無座標 → 不加入 pin
 *   6. 混合有/無座標 → hasData=true + missingCount 正確
 *   7. pin 包含正確的 travelMin, googleRating
 */

import { renderHook } from '@testing-library/react';
import { useMapData } from '../../src/hooks/useMapData';
import type { Day, Entry, Hotel } from '../../src/types/trip';

/* ===== Helpers ===== */

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 1,
    sortOrder: 1,
    title: 'Test Entry',
    restaurants: [],
    shopping: [],
    ...overrides,
  };
}

function makeHotel(overrides: Partial<Hotel> = {}): Hotel {
  return {
    id: 100,
    name: 'Test Hotel',
    shopping: [],
    ...overrides,
  };
}

function makeDay(overrides: Partial<Day> = {}): Day {
  return {
    id: 1,
    dayNum: 1,
    hotel: null,
    timeline: [],
    ...overrides,
  };
}

/* ===== Tests ===== */

describe('useMapData — 空資料', () => {
  it('1. day=null → 空陣列，missingCount=0，hasData=false', () => {
    const { result } = renderHook(() => useMapData(null));
    expect(result.current.pins).toEqual([]);
    expect(result.current.missingCount).toBe(0);
    expect(result.current.hasData).toBe(false);
  });

  it('2. day=undefined → 空陣列', () => {
    const { result } = renderHook(() => useMapData(undefined));
    expect(result.current.pins).toEqual([]);
    expect(result.current.hasData).toBe(false);
  });

  it('3. day 有 timeline=[] 且 hotel=null → 空', () => {
    const { result } = renderHook(() => useMapData(makeDay()));
    expect(result.current.pins).toEqual([]);
    expect(result.current.hasData).toBe(false);
  });
});

describe('useMapData — entry pins', () => {
  it('4. entry 有有效 lat/lng → 回傳一個 entry pin', () => {
    const day = makeDay({
      timeline: [
        makeEntry({
          id: 10,
          sortOrder: 1,
          title: '首里城',
          poi: { id: 101, type: 'attraction', name: '首里城', lat: 26.217, lng: 127.719 },
        }),
      ],
    });

    const { result } = renderHook(() => useMapData(day));
    expect(result.current.pins).toHaveLength(1);
    const pin = result.current.pins[0];
    expect(pin.type).toBe('entry');
    expect(pin.title).toBe('首里城');
    expect(pin.lat).toBeCloseTo(26.217);
    expect(pin.lng).toBeCloseTo(127.719);
    expect(pin.index).toBe(1);
    expect(result.current.hasData).toBe(true);
    expect(result.current.missingCount).toBe(0);
  });

  it('5. entry lat/lng = null → missingCount=1，pin 不加入', () => {
    const day = makeDay({
      timeline: [
        makeEntry({ id: 10, poi: null }),
      ],
    });

    const { result } = renderHook(() => useMapData(day));
    expect(result.current.pins).toHaveLength(0);
    expect(result.current.missingCount).toBe(1);
    expect(result.current.hasData).toBe(false);
  });

  it('6. entry lat/lng = 0 → 視為無效', () => {
    const day = makeDay({
      timeline: [
        makeEntry({ id: 10, poi: { id: 1, type: 'attraction', name: 'zero', lat: 0, lng: 0 } }),
      ],
    });

    const { result } = renderHook(() => useMapData(day));
    expect(result.current.pins).toHaveLength(0);
    expect(result.current.missingCount).toBe(1);
  });

  it('7. 2 個有座標 + 1 個無座標 → pins.length=2, missingCount=1', () => {
    const day = makeDay({
      timeline: [
        makeEntry({ id: 1, sortOrder: 1, poi: { id: 1, type: 'attraction', name: 'a', lat: 26.2, lng: 127.7 } }),
        makeEntry({ id: 2, sortOrder: 2, poi: null }),
        makeEntry({ id: 3, sortOrder: 3, poi: { id: 3, type: 'attraction', name: 'c', lat: 26.3, lng: 127.8 } }),
      ],
    });

    const { result } = renderHook(() => useMapData(day));
    expect(result.current.pins).toHaveLength(2);
    expect(result.current.missingCount).toBe(1);
    expect(result.current.hasData).toBe(true);

    // index 是連續的 (1, 2) — 跳過無座標 entry
    expect(result.current.pins[0].index).toBe(1);
    expect(result.current.pins[1].index).toBe(2);
  });

  it('8. entry pin 包含正確 travelMin / googleRating', () => {
    const day = makeDay({
      timeline: [
        makeEntry({
          id: 1,
          sortOrder: 1,
          poi: { id: 1, type: 'attraction', name: 'r', lat: 26.2, lng: 127.7, googleRating: 4.5 },
          travel: { type: 'car', min: 20 },
        }),
      ],
    });

    const { result } = renderHook(() => useMapData(day));
    const pin = result.current.pins[0];
    expect(pin.googleRating).toBe(4.5);
    expect(pin.travelMin).toBe(20);
  });
});

describe('useMapData — hotel pins', () => {
  it('9. hotel 有有效 lat/lng → 回傳 hotel pin (index=0, sortOrder=-1)', () => {
    const day = makeDay({
      hotel: makeHotel({
        id: 100,
        name: '那霸飯店',
        location: { lat: 26.21, lng: 127.68 },
      }),
      timeline: [],
    });

    const { result } = renderHook(() => useMapData(day));
    expect(result.current.pins).toHaveLength(1);
    const pin = result.current.pins[0];
    expect(pin.type).toBe('hotel');
    expect(pin.title).toBe('那霸飯店');
    expect(pin.index).toBe(0);
    expect(pin.sortOrder).toBe(-1);
  });

  it('10. hotel 無座標 → 不加入 pin', () => {
    const day = makeDay({
      hotel: makeHotel({ location: null }),
    });

    const { result } = renderHook(() => useMapData(day));
    expect(result.current.pins).toHaveLength(0);
  });

  it('11. hotel + entries 混合 → hotel pin 在前，entry pins 在後', () => {
    const day = makeDay({
      hotel: makeHotel({
        id: 100,
        name: 'Hotel',
        location: { lat: 26.21, lng: 127.68 },
      }),
      timeline: [
        makeEntry({ id: 1, sortOrder: 1, poi: { id: 1, type: 'attraction', name: 'a', lat: 26.2, lng: 127.7 } }),
        makeEntry({ id: 2, sortOrder: 2, poi: { id: 2, type: 'attraction', name: 'b', lat: 26.3, lng: 127.8 } }),
      ],
    });

    const { result } = renderHook(() => useMapData(day));
    expect(result.current.pins).toHaveLength(3);
    expect(result.current.pins[0].type).toBe('hotel');
    expect(result.current.pins[1].type).toBe('entry');
    expect(result.current.pins[2].type).toBe('entry');
  });
});
