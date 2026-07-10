/**
 * travel-mode.test.ts — v2.33.37 round 2 coverage
 *
 * `travelMode.ts` (PR-1 extract) 是 backend `trip_segments.mode` CHECK
 * constraint 的 frontend 對齊。labels / icons 漂移會讓 TravelPill 顯錯字。
 */
import { describe, it, expect } from 'vitest';
import {
  TRAVEL_MODE_LABEL, TRAVEL_MODE_ICON, type TravelMode,
  TRAVEL_METHODS, travelMethodLabel, travelMethodIcon, travelMethodKey,
} from '../../src/lib/travelMode';

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

// v2.55.45 — 8-方式 picker 的衍生 label/icon/key（單一 SoT = TRAVEL_METHODS）
describe('TRAVEL_METHODS table (v2.55.45)', () => {
  it('8 個方式、key 唯一、auto/freeText flag 對齊設計', () => {
    expect(TRAVEL_METHODS).toHaveLength(8);
    const keys = TRAVEL_METHODS.map((m) => m.key);
    expect(new Set(keys).size).toBe(8); // 無重複 key
    expect(keys).toEqual(['driving', 'walking', 'monorail', 'bus', 'metro', 'train', 'hsr', 'other']);
    // 自動方式：driving/walking/monorail/bus；手填：metro/train/hsr/other
    const auto = TRAVEL_METHODS.filter((m) => m.auto).map((m) => m.key);
    expect(auto).toEqual(['driving', 'walking', 'monorail', 'bus']);
    expect(TRAVEL_METHODS.find((m) => m.key === 'other')!.freeText).toBe(true);
  });
});

describe('travelMethodLabel (v2.55.45)', () => {
  it('transit 固定 submode → 具體方式 label', () => {
    expect(travelMethodLabel('transit', 'monorail')).toBe('單軌');
    expect(travelMethodLabel('transit', 'bus')).toBe('公車');
    expect(travelMethodLabel('transit', 'metro')).toBe('地鐵');
    expect(travelMethodLabel('transit', 'train')).toBe('火車');
    expect(travelMethodLabel('transit', 'hsr')).toBe('高鐵');
  });
  it('transit 未知 submode（其他自由文字）→ passthrough 原字串', () => {
    expect(travelMethodLabel('transit', '水上巴士')).toBe('水上巴士');
  });
  it('transit 無 submode → 回退 3-mode 大眾運輸；driving/walking → mode label', () => {
    expect(travelMethodLabel('transit', null)).toBe('大眾運輸');
    expect(travelMethodLabel('driving', null)).toBe('開車');
    expect(travelMethodLabel('walking', undefined)).toBe('步行');
  });
});

describe('travelMethodIcon (v2.55.45)', () => {
  it('transit 固定 submode → 對應 icon；未知 → bus fallback', () => {
    expect(travelMethodIcon('transit', 'monorail')).toBe('train');
    expect(travelMethodIcon('transit', 'bus')).toBe('bus');
    expect(travelMethodIcon('transit', 'metro')).toBe('train');
    expect(travelMethodIcon('transit', '水上巴士')).toBe('bus'); // 未知 → bus
  });
  it('無 submode → mode icon', () => {
    expect(travelMethodIcon('transit', null)).toBe('bus');
    expect(travelMethodIcon('driving', null)).toBe('car');
  });
});

describe('travelMethodKey (v2.55.45)', () => {
  it('driving/walking → mode；transit 固定 submode → submode key', () => {
    expect(travelMethodKey('driving', null)).toBe('driving');
    expect(travelMethodKey('walking', null)).toBe('walking');
    expect(travelMethodKey('transit', 'monorail')).toBe('monorail');
    expect(travelMethodKey('transit', 'hsr')).toBe('hsr');
  });
  it('transit 未知/NULL submode → other chip（legacy 大眾運輸 back-compat）', () => {
    expect(travelMethodKey('transit', '水上巴士')).toBe('other');
    expect(travelMethodKey('transit', null)).toBe('other');
  });
});
