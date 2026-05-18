/**
 * v2.31.79：marker 疊在一起時數字混在一起難讀。markerContent 加 text-shadow
 * halo（用 fill 當外框色）+ box-shadow 外圈分離環。Visual regression lock —
 * 確保未來 marker 視覺改寫沒砍掉這兩個區隔機制。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setupGoogleMapsMock } from './__mocks__/google-maps';
import { markerStyle, markerContent } from '../../src/components/trip/OceanMap';
import type { MapPin } from '../../src/hooks/useMapData';

beforeEach(setupGoogleMapsMock);

const SAMPLE: MapPin = {
  id: 1, index: 3, title: 'X', type: 'attraction',
  lat: 26.21, lng: 127.72, sortOrder: 1,
};

describe('v2.31.79: marker label has text-shadow halo + box-shadow outer ring', () => {
  it('idle marker：text-shadow 用 fill (white) 當 halo 色', () => {
    const style = markerStyle(SAMPLE, false, false);
    const el = markerContent(style);
    // text-shadow 至少含 4 個 fill 顏色的 offset 構成 1px halo
    const textShadow = el.style.textShadow;
    expect(textShadow).toContain(style.fill);
    // 出現次數 ≥4（4 corner + 4 edge）
    const occurrences = textShadow.split(style.fill).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(4);
  });

  it('idle marker：box-shadow 加 1.5px fill 外圈做 marker 邊界分離', () => {
    const style = markerStyle(SAMPLE, false, false);
    const el = markerContent(style);
    expect(el.style.boxShadow).toContain('1.5px');
    expect(el.style.boxShadow).toContain(style.fill);
  });

  it('focused (active) marker：text-shadow 用 ACCENT fill 當 halo', () => {
    const style = markerStyle(SAMPLE, true, false);
    const el = markerContent(style);
    // focused fill 是 ACCENT_COLOR (#D97848)
    expect(style.fill).toBe('#D97848');
    expect(el.style.textShadow).toContain(style.fill);
    expect(el.style.boxShadow).toContain(style.fill);
  });

  it('past marker：text-shadow + box-shadow 都還在（不會因 mute 而消失）', () => {
    const style = markerStyle(SAMPLE, false, true);
    const el = markerContent(style);
    expect(el.style.textShadow).toContain(style.fill);
    expect(el.style.boxShadow).toContain(style.fill);
  });

  it('dayColor 不影響 halo 顏色（halo 永遠等於 fill bg）', () => {
    const styleDefault = markerStyle(SAMPLE, false, false);
    const styleWithDayCol = markerStyle(SAMPLE, false, false, '#FF6B35');
    const elDefault = markerContent(styleDefault);
    const elWithDay = markerContent(styleWithDayCol);
    // dayColor 改 stroke + text，但 fill 不變 → halo 不變
    expect(styleDefault.fill).toBe(styleWithDayCol.fill);
    expect(elDefault.style.textShadow).toBe(elWithDay.style.textShadow);
  });

  it('textContent + borderRadius 仍維持 v2.31.75 contract', () => {
    const style = markerStyle(SAMPLE, false, false);
    const el = markerContent(style);
    expect(el.textContent).toBe('3');
    expect(el.style.borderRadius).toBe('50%');
  });
});
