/**
 * travel-mode.test.ts — v2.33.37 round 2 coverage
 *
 * `travelMode.ts` (PR-1 extract) 是 backend `trip_segments.mode` CHECK
 * constraint 的 frontend 對齊。labels / icons 漂移會讓 TravelPill 顯錯字。
 */
import { describe, it, expect } from 'vitest';
import { TRAVEL_MODE_LABEL, TRAVEL_MODE_ICON, type TravelMode } from '../../src/lib/travelMode';

describe('TRAVEL_MODE_LABEL', () => {
  it('driving = 開車 / walking = 步行 / transit = 大眾運輸', () => {
    expect(TRAVEL_MODE_LABEL.driving).toBe('開車');
    expect(TRAVEL_MODE_LABEL.walking).toBe('步行');
    expect(TRAVEL_MODE_LABEL.transit).toBe('大眾運輸');
  });

  it('全 3 個 TravelMode 都有 label', () => {
    const modes: TravelMode[] = ['driving', 'walking', 'transit'];
    for (const m of modes) {
      expect(TRAVEL_MODE_LABEL[m]).toBeTruthy();
      expect(typeof TRAVEL_MODE_LABEL[m]).toBe('string');
    }
  });
});

describe('TRAVEL_MODE_ICON', () => {
  it('driving = car / walking = walking / transit = bus', () => {
    expect(TRAVEL_MODE_ICON.driving).toBe('car');
    expect(TRAVEL_MODE_ICON.walking).toBe('walking');
    expect(TRAVEL_MODE_ICON.transit).toBe('bus');
  });

  it('全 3 個 TravelMode 都有 icon', () => {
    const modes: TravelMode[] = ['driving', 'walking', 'transit'];
    for (const m of modes) {
      expect(TRAVEL_MODE_ICON[m]).toBeTruthy();
      expect(typeof TRAVEL_MODE_ICON[m]).toBe('string');
    }
  });
});

describe('TravelMode type completeness', () => {
  it('LABEL keys === ICON keys (no orphan modes)', () => {
    expect(Object.keys(TRAVEL_MODE_LABEL).sort()).toEqual(Object.keys(TRAVEL_MODE_ICON).sort());
  });
});
