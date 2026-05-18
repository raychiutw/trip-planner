/**
 * v2.31.79：marker 疊在一起時數字混在一起難讀。markerContent 加 text-shadow
 * halo（用 fill 當外框色）+ box-shadow 外圈分離環。
 *
 * v2.31.84：加強對比 — halo 1px → 2px，box-shadow 加 outer drop shadow
 *           (rgba 0,0,0,0.18) 做 elevation marker 間分離。Visual regression
 *           lock — 鎖 2px halo + drop shadow 雙條件。
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

describe('v2.31.84: marker label halo 2px + box-shadow drop shadow elevation', () => {
  it('idle marker：text-shadow 用 fill (white) 當 halo 色，2px 寬度', () => {
    const style = markerStyle(SAMPLE, false, false);
    const el = markerContent(style);
    const textShadow = el.style.textShadow;
    expect(textShadow).toContain(style.fill);
    // v2.31.84：halo width 1px → 2px
    expect(textShadow).toContain('2px');
    // 出現次數 ≥4（4 corner + 4 edge）
    const occurrences = textShadow.split(style.fill).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(4);
  });

  it('idle marker：box-shadow 保留 1.5px fill inner ring + 加 3px drop shadow', () => {
    const style = markerStyle(SAMPLE, false, false);
    const el = markerContent(style);
    const bs = el.style.boxShadow;
    // v2.31.79 inner fill ring 保留
    expect(bs).toContain('1.5px');
    expect(bs).toContain(style.fill);
    // v2.31.84 加 outer 3px drop shadow（rgba black 0.18）做 elevation 分離
    expect(bs).toContain('3px');
    expect(bs.toLowerCase()).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.18\)/);
  });

  it('focused (active) marker：halo + box-shadow 仍用 ACCENT fill', () => {
    const style = markerStyle(SAMPLE, true, false);
    const el = markerContent(style);
    expect(style.fill).toBe('#D97848');
    expect(el.style.textShadow).toContain(style.fill);
    expect(el.style.boxShadow).toContain(style.fill);
    // drop shadow elevation 不依 state，永遠存在
    expect(el.style.boxShadow.toLowerCase()).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.18\)/);
  });

  it('past marker：halo + drop shadow 都還在（mute 不消失）', () => {
    const style = markerStyle(SAMPLE, false, true);
    const el = markerContent(style);
    expect(el.style.textShadow).toContain(style.fill);
    expect(el.style.boxShadow).toContain(style.fill);
    expect(el.style.boxShadow.toLowerCase()).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.18\)/);
  });

  it('dayColor 不影響 halo 顏色（halo 永遠等於 fill bg）', () => {
    const styleDefault = markerStyle(SAMPLE, false, false);
    const styleWithDayCol = markerStyle(SAMPLE, false, false, '#FF6B35');
    const elDefault = markerContent(styleDefault);
    const elWithDay = markerContent(styleWithDayCol);
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
