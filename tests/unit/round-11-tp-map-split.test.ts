/**
 * round-11-oceanmap-split.test.ts — architectural guard for v2.33.57 split
 *
 * TpMap.tsx 606→303 LOC split 後架構鎖：
 *  1. lib/mapHelpers + lib/mapTypes 存在且 leaf (no React import)
 *  2. 3 個 hook (useMapMarkers / useMapViewport / useMapSegments) 存在
 *  3. TpMap.tsx call 3 hook 對齊原 effect 順序 (markers → viewport → segments)
 *  4. 17+ 個 backward-compat re-export 維持
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf-8');

const OCEAN_MAP = read('src/components/trip/TpMap.tsx');
const HELPERS = read('src/lib/mapHelpers.ts');
const TYPES = read('src/lib/mapTypes.ts');
const HOOK_MARKERS = read('src/hooks/useMapMarkers.ts');
const HOOK_VIEWPORT = read('src/hooks/useMapViewport.ts');
const HOOK_SEGMENTS = read('src/hooks/useMapSegments.ts');
const USE_MAP_DATA = read('src/hooks/useMapData.ts');
const USE_ROUTE = read('src/hooks/useRoute.ts');

describe('v2.33.57 round 11 — TpMap split: lib leaf-ness', () => {
  it('mapHelpers.ts 不 import React or hook', () => {
    expect(HELPERS).not.toMatch(/from\s+['"]react['"]/);
    expect(HELPERS).not.toMatch(/from\s+['"]\.\.\/hooks\//);
    expect(HELPERS).not.toMatch(/from\s+['"]\.\.\/components\//);
  });

  it('mapTypes.ts 純 type — 0 runtime import', () => {
    expect(TYPES).not.toMatch(/^import\s+(?!type\s)/m);
  });

  it('useMapData / useRoute 透過 re-export 維持 MapPin / Coord backward compat', () => {
    expect(USE_MAP_DATA).toContain("export type { MapPin, MapPinType } from '../lib/mapTypes'");
    expect(USE_ROUTE).toContain("export type { Coord } from '../lib/mapTypes'");
  });
});

describe('v2.33.57 round 11 — 3 hooks 存在 + 單一職責', () => {
  it('useMapMarkers owns markersRef + prevFocusRef + 2 effect', () => {
    expect(HOOK_MARKERS).toContain('useRef<Map<number, google.maps.marker.AdvancedMarkerElement>>');
    expect(HOOK_MARKERS).toContain('prevFocusRef');
    expect(HOOK_MARKERS).toMatch(/useEffect\([\s\S]*?useEffect\(/);
  });

  it('useMapViewport owns fitDoneRef + 3 effect (fit / resize / pan)', () => {
    expect(HOOK_VIEWPORT).toContain('fitDoneRef');
    expect(HOOK_VIEWPORT).toMatch(/useEffect\([\s\S]*?useEffect\([\s\S]*?useEffect\(/);
    expect(HOOK_VIEWPORT).toContain('fitBounds');
    expect(HOOK_VIEWPORT).toContain('flyTo');
  });

  it('useMapSegments returns SegmentPair[] via useMemo', () => {
    expect(HOOK_SEGMENTS).toContain('SegmentPair[]');
    expect(HOOK_SEGMENTS).toContain('return useMemo(');
    expect(HOOK_SEGMENTS).toContain('buildSegments');
  });
});

describe('v2.33.57 round 11 — TpMap.tsx compose shell', () => {
  it('LOC under 350 (compose shell, was 606)', () => {
    const lineCount = OCEAN_MAP.split('\n').length;
    expect(lineCount).toBeLessThan(350);
  });

  it('Hook call 順序對齊原 effect 順序: useMapMarkers → useMapViewport → useMapSegments', () => {
    const markersIdx = OCEAN_MAP.indexOf('useMapMarkers({');
    const viewportIdx = OCEAN_MAP.indexOf('useMapViewport({');
    const segmentsIdx = OCEAN_MAP.indexOf('useMapSegments({');
    expect(markersIdx).toBeGreaterThan(-1);
    expect(viewportIdx).toBeGreaterThan(markersIdx);
    expect(segmentsIdx).toBeGreaterThan(viewportIdx);
  });

  it('Backward-compat re-export markerStyle / markerContent / buildSegments / MarkerStyle / SegmentPair', () => {
    expect(OCEAN_MAP).toContain('export { markerStyle, markerContent, buildSegments }');
    expect(OCEAN_MAP).toContain('export type { MarkerStyle, SegmentPair }');
  });
});
