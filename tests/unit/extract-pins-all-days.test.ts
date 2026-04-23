/**
 * extract-pins-all-days.test.ts — unit test for extractPinsFromAllDays helper
 */

import { describe, it, expect } from 'vitest';
import { extractPinsFromAllDays } from '../../src/hooks/useMapData';
import type { Day } from '../../src/types/trip';

function makeDay(id: number, overrides: Partial<Day> = {}): Day {
  return {
    id,
    label: `Day ${id}`,
    date: `2026-07-${String(id).padStart(2, '0')}`,
    hotel: null,
    timeline: [],
    ...overrides,
  } as Day;
}

function makeEntry(id: number, sortOrder: number, lat: number | null, lng: number | null) {
  return {
    id,
    sortOrder,
    title: `entry ${id}`,
    time: '10:00',
    location: lat !== null && lng !== null ? { lat, lng, name: `POI ${id}` } : null,
    restaurants: [],
    shopping: [],
    travel: null,
    googleRating: null,
    description: null,
    note: null,
  } as unknown as Day['timeline'][number];
}

describe('extractPinsFromAllDays', () => {
  it('null / undefined input 回傳 empty', () => {
    expect(extractPinsFromAllDays(null)).toEqual({
      pins: [],
      pinsByDay: expect.any(Map),
      missingCount: 0,
    });
    const r = extractPinsFromAllDays(null);
    expect(r.pinsByDay.size).toBe(0);
  });

  it('多天各自 group 為獨立 pinsByDay entry', () => {
    const days = {
      1: makeDay(1, { timeline: [makeEntry(101, 0, 26.1, 127.6), makeEntry(102, 1, 26.2, 127.7)] }),
      2: makeDay(2, { timeline: [makeEntry(201, 0, 26.3, 127.8)] }),
    };
    const r = extractPinsFromAllDays(days);
    expect(r.pins).toHaveLength(3);
    expect(r.pinsByDay.size).toBe(2);
    expect(r.pinsByDay.get(1)).toHaveLength(2);
    expect(r.pinsByDay.get(2)).toHaveLength(1);
  });

  it('天按 dayNum 升序處理（保持 sort 穩定）', () => {
    // Object key 順序未必可靠，但實作應排序 dayNum
    const days = {
      3: makeDay(3, { timeline: [makeEntry(301, 0, 26.4, 127.9)] }),
      1: makeDay(1, { timeline: [makeEntry(101, 0, 26.1, 127.6)] }),
      2: makeDay(2, { timeline: [makeEntry(201, 0, 26.2, 127.7)] }),
    };
    const r = extractPinsFromAllDays(days);
    // flat pins 順序應為 Day 1 → 2 → 3
    expect(r.pins[0]!.id).toBe(101);
    expect(r.pins[1]!.id).toBe(201);
    expect(r.pins[2]!.id).toBe(301);
  });

  it('缺座標 entry 計入 missingCount 但不加進 pins', () => {
    const days = {
      1: makeDay(1, { timeline: [makeEntry(101, 0, 26.1, 127.6), makeEntry(102, 1, null, null)] }),
    };
    const r = extractPinsFromAllDays(days);
    expect(r.pins).toHaveLength(1);
    expect(r.missingCount).toBe(1);
  });

  it('整天無有效 pin 不出現於 pinsByDay', () => {
    const days = {
      1: makeDay(1, { timeline: [makeEntry(101, 0, 26.1, 127.6)] }),
      2: makeDay(2, { timeline: [makeEntry(201, 0, null, null)] }),
    };
    const r = extractPinsFromAllDays(days);
    expect(r.pinsByDay.has(1)).toBe(true);
    expect(r.pinsByDay.has(2)).toBe(false);
    expect(r.missingCount).toBe(1);
  });
});
