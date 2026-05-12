import { describe, expect, it } from 'vitest';
import {
  getStopDisplayTitle,
  getTimelineEntryDisplayTitle,
  isGenericMealStopTitle,
} from '../../src/lib/stopDisplay';

describe('stopDisplay', () => {
  it('treats bare meal labels as generic stop titles', () => {
    expect(isGenericMealStopTitle('午餐')).toBe(true);
    expect(isGenericMealStopTitle(' lunch ')).toBe(true);
    expect(isGenericMealStopTitle('本部午餐')).toBe(false);
  });

  it('uses restaurant POI name when a generic meal stop has a selected restaurant', () => {
    expect(getStopDisplayTitle({
      title: '午餐',
      poiName: '敘敘苑 沖繩浦添PARCO CITY店',
      poiType: 'restaurant',
    })).toBe('敘敘苑 沖繩浦添PARCO CITY店');
  });

  it('keeps specific non-generic titles unchanged', () => {
    expect(getStopDisplayTitle({
      title: '本部午餐',
      poiName: 'きしもと食堂',
      poiType: 'restaurant',
    })).toBe('本部午餐');
  });

  it('prefers explicit displayTitle in timeline labels', () => {
    expect(getTimelineEntryDisplayTitle({
      title: '午餐',
      displayTitle: '敘敘苑 沖繩浦添PARCO CITY店',
    })).toBe('敘敘苑 沖繩浦添PARCO CITY店');
  });
});
