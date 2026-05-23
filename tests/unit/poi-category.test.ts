/**
 * poi-category.test.ts — v2.33.37 round 2 coverage
 *
 * `poiCategory.ts` 是 POI type 的單一來源，被 5 個 page (AddStopPage /
 * ChangePoiPage / ExplorePage / PoiFavoritesPage / AddPoiFavoriteToTripPage)
 * + backend 共用。漏一個 case → label 顯示錯誤、CHECK constraint fail。
 *
 * 直接 unit-test 不靠 source-grep。
 */
import { describe, it, expect } from 'vitest';
import { mapNominatimCategory, POI_TYPE_LABELS } from '../../src/lib/poiCategory';

describe('mapNominatimCategory', () => {
  it('null / undefined / empty string → "attraction" fallback', () => {
    expect(mapNominatimCategory(null)).toBe('attraction');
    expect(mapNominatimCategory(undefined)).toBe('attraction');
    expect(mapNominatimCategory('')).toBe('attraction');
  });

  it('hotel / lodging / tourism → "hotel"', () => {
    expect(mapNominatimCategory('hotel')).toBe('hotel');
    expect(mapNominatimCategory('lodging')).toBe('hotel');
    expect(mapNominatimCategory('tourism')).toBe('hotel');
    expect(mapNominatimCategory('TOURISM_HOTEL')).toBe('hotel'); // case-insensitive
  });

  it('restaurant / food / amenity → "restaurant"', () => {
    expect(mapNominatimCategory('restaurant')).toBe('restaurant');
    expect(mapNominatimCategory('food')).toBe('restaurant');
    expect(mapNominatimCategory('amenity')).toBe('restaurant');
    expect(mapNominatimCategory('RAMEN_RESTAURANT')).toBe('restaurant');
  });

  it('shop / mall / retail → "shopping"', () => {
    expect(mapNominatimCategory('shop')).toBe('shopping');
    expect(mapNominatimCategory('mall')).toBe('shopping');
    expect(mapNominatimCategory('retail')).toBe('shopping');
    expect(mapNominatimCategory('shopping_mall')).toBe('shopping');
  });

  it('parking → "parking"', () => {
    expect(mapNominatimCategory('parking')).toBe('parking');
    expect(mapNominatimCategory('PUBLIC_PARKING')).toBe('parking');
  });

  it('transport / railway / airport → "transport"', () => {
    expect(mapNominatimCategory('transport')).toBe('transport');
    expect(mapNominatimCategory('railway_station')).toBe('transport');
    expect(mapNominatimCategory('airport')).toBe('transport');
  });

  it('activity / leisure → "activity"', () => {
    expect(mapNominatimCategory('activity')).toBe('activity');
    expect(mapNominatimCategory('leisure')).toBe('activity');
  });

  it('unknown category → "attraction" fallback', () => {
    expect(mapNominatimCategory('SOMETHING_NEW')).toBe('attraction');
    expect(mapNominatimCategory('point_of_interest')).toBe('attraction');
  });

  it('first match wins (hotel takes precedence over tourism in same string)', () => {
    // tourism 也 hits hotel branch — 兩者都對映 hotel，driver test 不重要。
    // 但若 string 同時含 'hotel' 和 'shop'，hotel 先 match。
    expect(mapNominatimCategory('hotel_shop')).toBe('hotel');
  });
});

describe('POI_TYPE_LABELS — canonical zh-TW labels', () => {
  it('hotel = 飯店 (PR-1 canonical, was 住宿 historically)', () => {
    expect(POI_TYPE_LABELS.hotel).toBe('飯店');
  });

  it('attraction = 景點 / restaurant = 餐廳 / shopping = 購物', () => {
    expect(POI_TYPE_LABELS.attraction).toBe('景點');
    expect(POI_TYPE_LABELS.restaurant).toBe('餐廳');
    expect(POI_TYPE_LABELS.shopping).toBe('購物');
  });

  it('transport = 交通 (v2.31.23 fix unified)', () => {
    expect(POI_TYPE_LABELS.transport).toBe('交通');
  });

  it('parking / activity / other 對齊', () => {
    expect(POI_TYPE_LABELS.parking).toBe('停車');
    expect(POI_TYPE_LABELS.activity).toBe('活動');
    expect(POI_TYPE_LABELS.other).toBe('其他');
  });

  it('全 8 個 PoiType 都有 label', () => {
    const expectedKeys: Array<keyof typeof POI_TYPE_LABELS> = [
      'restaurant', 'attraction', 'shopping', 'hotel',
      'parking', 'transport', 'activity', 'other',
    ];
    for (const k of expectedKeys) {
      expect(POI_TYPE_LABELS[k]).toBeTruthy();
      expect(typeof POI_TYPE_LABELS[k]).toBe('string');
    }
  });
});
