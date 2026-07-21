/**
 * classifyMapClick — TDD red test.
 *
 * 地圖點選 Google 原生 POI（owner 2026-07-21，對齊 Flutter trip_map_screen.dart 的
 * onPoiClicked/onMapClicked 二分派）。Google Maps JS API 的 map 'click' 事件在點到
 * POI 圖示時是 IconMouseEvent（含 placeId），點空白處是普通 MapMouseEvent（無
 * placeId）。這個 pure function 把兩者分類，不碰 DOM / google.maps 實例，方便測試
 * （對齊 mapHelpers.ts 既有「lib 為 leaf layer，pure function 優先測」慣例）。
 */
import { describe, it, expect } from 'vitest';
import { classifyMapClick } from '../../src/lib/mapHelpers';

function fakeLatLng(lat: number, lng: number) {
  return { lat: () => lat, lng: () => lng };
}

describe('classifyMapClick', () => {
  it('placeId + latLng present → poi result with placeId/lat/lng', () => {
    const result = classifyMapClick({
      placeId: 'ChIJ-place-id',
      latLng: fakeLatLng(26.2, 127.6),
    });
    expect(result).toEqual({
      type: 'poi',
      poi: { placeId: 'ChIJ-place-id', lat: 26.2, lng: 127.6 },
    });
  });

  it('no placeId (plain background click) → background result', () => {
    const result = classifyMapClick({
      placeId: null,
      latLng: fakeLatLng(26.2, 127.6),
    });
    expect(result).toEqual({ type: 'background' });
  });

  it('placeId undefined (MapMouseEvent has no placeId field at all) → background', () => {
    const result = classifyMapClick({ latLng: fakeLatLng(0, 0) });
    expect(result).toEqual({ type: 'background' });
  });

  it('placeId present but latLng missing (defensive) → background, not throw', () => {
    const result = classifyMapClick({ placeId: 'x', latLng: null });
    expect(result).toEqual({ type: 'background' });
  });

  it('empty-string placeId → background (falsy guard)', () => {
    const result = classifyMapClick({ placeId: '', latLng: fakeLatLng(1, 2) });
    expect(result).toEqual({ type: 'background' });
  });
});
