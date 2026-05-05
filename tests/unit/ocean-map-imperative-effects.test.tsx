/**
 * ocean-map-imperative-effects — verify pure helpers exported from OceanMap.tsx
 * (post v2.23.0 Google Maps rewrite).
 *
 * Old test focused on Leaflet imperative side effects (marker.setIcon /
 * map.panTo / etc.). The Google rewrite delegates much of that to googleMaps.*
 * native methods, so direct DOM/effect testing is not high-value. This rewrite
 * tests the **pure functions** OceanMap exports — buildSegments() — which is
 * where the per-day polyline pairing logic lives. That's the bug-prone area.
 *
 * Also verify markerIcon's day-color contract round-trip (idle uses dayColor;
 * active overrides; past mutes).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setupGoogleMapsMock } from './__mocks__/google-maps';
import { markerIcon, buildSegments } from '../../src/components/trip/OceanMap';
import type { MapPin } from '../../src/hooks/useMapData';

beforeEach(setupGoogleMapsMock);

const pin = (id: number, idx: number, dayLat = 26, dayLng = 127, sortOrder = idx): MapPin => ({
  id,
  index: idx,
  title: `POI-${id}`,
  type: 'attraction',
  lat: dayLat,
  lng: dayLng,
  sortOrder,
});

describe('OceanMap.buildSegments (flat pins mode)', () => {
  it('empty pins → no segments', () => {
    const result = buildSegments({
      pins: [],
      focusedIdx: -1,
      pinIndexById: new Map(),
    });
    expect(result).toEqual([]);
  });

  it('single pin → no segments (need ≥2 to draw line)', () => {
    const pins = [pin(1, 1)];
    const result = buildSegments({
      pins,
      focusedIdx: 0,
      pinIndexById: new Map([[1, 0]]),
    });
    expect(result).toEqual([]);
  });

  it('3 pins → 2 consecutive segments with stable keys', () => {
    const pins = [pin(1, 1), pin(2, 2), pin(3, 3)];
    const result = buildSegments({
      pins,
      focusedIdx: -1,
      pinIndexById: new Map([[1, 0], [2, 1], [3, 2]]),
    });
    expect(result).toHaveLength(2);
    expect(result[0]?.key).toBe('1->2');
    expect(result[1]?.key).toBe('2->3');
  });

  it('focusedIdx=1 → both adjacent segments isActive', () => {
    const pins = [pin(1, 1), pin(2, 2), pin(3, 3)];
    const result = buildSegments({
      pins,
      focusedIdx: 1,
      pinIndexById: new Map([[1, 0], [2, 1], [3, 2]]),
    });
    expect(result[0]?.isActive).toBe(true);  // 0→1 includes idx 1
    expect(result[1]?.isActive).toBe(true);  // 1→2 includes idx 1
  });

  it('dayNum 套到所有 segments (single-day mode)', () => {
    const pins = [pin(1, 1), pin(2, 2)];
    const result = buildSegments({
      pins,
      focusedIdx: -1,
      pinIndexById: new Map([[1, 0], [2, 1]]),
      dayNum: 4,
    });
    expect(result[0]?.dayNum).toBe(4);
  });
});

describe('OceanMap.buildSegments (per-day mode)', () => {
  it('cross-day pairs NOT drawn (僅 within-day segments)', () => {
    // Day 1: pin 1, 2 / Day 2: pin 3, 4
    // Should produce 2 segments (1→2 in day1, 3→4 in day2), NOT 2→3 cross-day
    const pinsByDay = new Map<number, MapPin[]>([
      [1, [pin(1, 1), pin(2, 2)]],
      [2, [pin(3, 3), pin(4, 4)]],
    ]);
    const flat = [pin(1, 1), pin(2, 2), pin(3, 3), pin(4, 4)];
    const result = buildSegments({
      pins: flat,
      pinsByDay,
      focusedIdx: -1,
      pinIndexById: new Map([[1, 0], [2, 1], [3, 2], [4, 3]]),
    });
    expect(result).toHaveLength(2);
    const keys = result.map((s) => s.key);
    expect(keys).toContain('1->2');
    expect(keys).toContain('3->4');
    expect(keys).not.toContain('2->3'); // no cross-day
  });

  it('hotel sortOrder=-1 starts the chain (within day)', () => {
    // Day 1: hotel(id=99, sort=-1) + entry(id=1, sort=1) + entry(id=2, sort=2)
    const hotel = { ...pin(99, 0), sortOrder: -1 };
    const e1 = pin(1, 1, 26, 127, 1);
    const e2 = pin(2, 2, 26, 127, 2);
    const pinsByDay = new Map([[1, [e1, e2, hotel]]]);  // unsorted input
    const flat = [hotel, e1, e2];
    const result = buildSegments({
      pins: flat,
      pinsByDay,
      focusedIdx: -1,
      pinIndexById: new Map([[99, 0], [1, 1], [2, 2]]),
    });
    // Sorted by sortOrder (-1 first): hotel → e1 → e2
    expect(result[0]?.key).toBe('99->1');
    expect(result[1]?.key).toBe('1->2');
  });

  it('per-day mode preserves dayNum on each pair', () => {
    const pinsByDay = new Map([
      [3, [pin(1, 1), pin(2, 2)]],
    ]);
    const result = buildSegments({
      pins: [pin(1, 1), pin(2, 2)],
      pinsByDay,
      focusedIdx: -1,
      pinIndexById: new Map([[1, 0], [2, 1]]),
    });
    expect(result[0]?.dayNum).toBe(3);
  });
});

describe('OceanMap.markerIcon (color contract)', () => {
  it('idle marker uses dayColor for stroke + label', () => {
    const opts = markerIcon(pin(1, 1), false, false, '#FF6B35');
    expect(opts.icon.strokeColor).toBe('#FF6B35');
    expect(opts.label.color).toBe('#FF6B35');
  });

  it('idle without dayColor falls back to muted neutral', () => {
    const opts = markerIcon(pin(1, 1), false, false);
    expect(opts.icon.strokeColor).toBe('#C1C1C1');
    expect(opts.label.color).toBe('#6A6A6A');
  });

  it('past marker mutes both stroke + label (regardless of dayColor)', () => {
    const opts = markerIcon(pin(1, 1), false, true, '#FF6B35');
    expect(opts.icon.strokeColor).toBe('#E0E0E0');
    expect(opts.label.color).toBe('#C1C1C1');
  });

  it('focused marker uses accent color + larger size', () => {
    const opts = markerIcon(pin(1, 1), true, false, '#FF6B35');
    expect(opts.icon.fillColor).toBe('#D97848'); // ACCENT_COLOR
    expect(opts.label.color).toBe('#FFFFFF');    // ACCENT_FG
    expect(opts.icon.scale).toBeGreaterThan(15); // larger than idle 14
  });
});
