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

  it('uses the primary POI name even when the entry title is specific', () => {
    expect(getStopDisplayTitle({
      title: '本部午餐',
      poiName: 'きしもと食堂',
      poiType: 'restaurant',
    })).toBe('きしもと食堂');
  });

  it('does not fall back to stale entry title when no POI name exists', () => {
    expect(getStopDisplayTitle({
      title: '東南植物樂園',
      poiName: null,
      poiType: 'restaurant',
    })).toBeNull();
  });

  it('prefers explicit displayTitle in timeline labels', () => {
    expect(getTimelineEntryDisplayTitle({
      title: '午餐',
      displayTitle: '敘敘苑 沖繩浦添PARCO CITY店',
    })).toBe('敘敘苑 沖繩浦添PARCO CITY店');
  });

  it('does not fall back to raw entry title in timeline labels', () => {
    expect(getTimelineEntryDisplayTitle({
      title: '東南植物樂園',
      displayTitle: null,
    })).toBe('（未選擇景點）');
  });
});
