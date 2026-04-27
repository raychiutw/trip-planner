/**
 * ocean-map-build-segments.test.ts — runtime coverage for buildSegments pure helper.
 *
 * Per DESIGN.md「地圖 Polyline 規格」:
 * - hotel (sortOrder=-1) IS the day's first node — must form the leading segment
 * - cross-day segments must NOT be drawn in pinsByDay mode
 * - flat mode still connects consecutive pairs
 */

import { describe, it, expect } from 'vitest';
import { buildSegments } from '../../src/components/trip/OceanMap';
import type { MapPin } from '../../src/hooks/useMapData';

function makeEntry(id: number, lat: number, lng: number): MapPin {
  return {
    id, type: 'entry', index: id, title: `e${id}`, lat, lng, sortOrder: id,
  };
}
function makeHotel(id: number, lat: number, lng: number): MapPin {
  return {
    id, type: 'hotel', index: 0, title: `h${id}`, lat, lng, sortOrder: -1,
  };
}

describe('buildSegments — pinsByDay mode', () => {
  it('does NOT draw a cross-day segment (Day 1 last → Day 2 first)', () => {
    const pinsByDay = new Map<number, MapPin[]>([
      [1, [makeEntry(1, 26.10, 127.60), makeEntry(2, 26.11, 127.61)]],
      [2, [makeEntry(3, 26.20, 127.70), makeEntry(4, 26.21, 127.71)]],
    ]);
    const segs = buildSegments({
      pins: [], pinsByDay, focusedIdx: -1, pinIndexById: new Map(),
    });
    // Expect exactly 2 segments: 1→2 (within Day 1), 3→4 (within Day 2)
    expect(segs).toHaveLength(2);
    expect(segs.map((s) => s.key)).toEqual(['1->2', '3->4']);
    // Cross-day segment 2→3 MUST NOT appear
    expect(segs.find((s) => s.key === '2->3')).toBeUndefined();
  });

  it('hotel leads the day — segments are hotel→first-stop→next-stop', () => {
    const pinsByDay = new Map<number, MapPin[]>([
      [1, [makeHotel(99, 26.05, 127.55), makeEntry(1, 26.10, 127.60), makeEntry(2, 26.11, 127.61)]],
    ]);
    const segs = buildSegments({
      pins: [], pinsByDay, focusedIdx: -1, pinIndexById: new Map(),
    });
    // Hotel sortOrder=-1 sorts first, then entries by sortOrder.
    // Expect 2 segments: hotel→entry1, entry1→entry2.
    expect(segs).toHaveLength(2);
    expect(segs[0]!.key).toBe('99->1');
    expect(segs[1]!.key).toBe('1->2');
  });

  it('hotel-less day still connects entries normally', () => {
    const pinsByDay = new Map<number, MapPin[]>([
      [1, [makeEntry(1, 26.10, 127.60), makeEntry(2, 26.11, 127.61)]],
    ]);
    const segs = buildSegments({
      pins: [], pinsByDay, focusedIdx: -1, pinIndexById: new Map(),
    });
    expect(segs).toHaveLength(1);
    expect(segs[0]!.key).toBe('1->2');
  });

  it('tags each segment with its dayNum', () => {
    const pinsByDay = new Map<number, MapPin[]>([
      [3, [makeEntry(1, 26.10, 127.60), makeEntry(2, 26.11, 127.61)]],
    ]);
    const segs = buildSegments({
      pins: [], pinsByDay, focusedIdx: -1, pinIndexById: new Map(),
    });
    expect(segs[0]!.dayNum).toBe(3);
  });

  it('empty pinsByDay Map falls through to flat pins mode', () => {
    const pins: MapPin[] = [makeEntry(1, 26.10, 127.60), makeEntry(2, 26.11, 127.61)];
    const segs = buildSegments({
      pins, pinsByDay: new Map(), focusedIdx: -1, pinIndexById: new Map(), dayNum: 2,
    });
    expect(segs).toHaveLength(1);
    expect(segs[0]!.dayNum).toBe(2);
  });
});

describe('buildSegments — flat pins mode', () => {
  it('connects consecutive pairs and tags with single dayNum', () => {
    const pins: MapPin[] = [
      makeEntry(1, 26.10, 127.60),
      makeEntry(2, 26.11, 127.61),
      makeEntry(3, 26.12, 127.62),
    ];
    const segs = buildSegments({
      pins, focusedIdx: -1, pinIndexById: new Map(), dayNum: 1,
    });
    expect(segs).toHaveLength(2);
    expect(segs.map((s) => s.key)).toEqual(['1->2', '2->3']);
    expect(segs.every((s) => s.dayNum === 1)).toBe(true);
  });

  it('returns empty when <2 pins', () => {
    const segs = buildSegments({
      pins: [makeEntry(1, 26.10, 127.60)], focusedIdx: -1, pinIndexById: new Map(),
    });
    expect(segs).toEqual([]);
  });
});
