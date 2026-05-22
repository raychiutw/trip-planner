/**
 * v2.31.87 #5+#6：TimelineRail row click 展開 → map flyTo zoom；收合 → flyTo zoom out。
 *
 * v2.31.88：zoom level 對齊 MapPage focusId flow — expand 15→13，collapse 11→10。
 *
 * v2.31.93：refactor — TripMapRail 改用 focusId flow（同 MapPage），
 *           expand/collapse 不再手動 setPanToCoord+zoom，改 setFocusedEntryId 觸發
 *           OceanMap useEffect 切 marker 視覺 + flyTo zoom 13 + collapse fitBounds reset。
 *           本檔保留仍 valid 的 contract：TimelineRail dispatch shape + OceanMap panToCoord
 *           prop shape（pin-click fallback / scroll spy 仍用）。Zoom 值 assertion 由
 *           v2_31_93-trip-map-focusid-marker.test.ts 接手。
 *
 * Source-grep lock：detail.isExpanding 區分 + panToCoord 接 zoom field + OceanMap flyTo path。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(__dirname, '../..', rel), 'utf8');

describe('v2.31.87 #5+#6: map zoom on TimelineRail expand/collapse', () => {
  const railSrc = read('src/components/trip/TimelineRail.tsx');
  const tripMapRailSrc = read('src/components/trip/TripMapRail.tsx');
  const oceanMapSrc = read('src/components/trip/OceanMap.tsx');

  it('TimelineRail row click dispatch event detail 含 isExpanding: !expanded', () => {
    expect(railSrc).toMatch(/detail:\s*\{\s*entryId:\s*entry\.id,\s*isExpanding:\s*!expanded\s*\}/);
  });

  it('TripMapRail panToCoord state 接 zoom optional field（pin-click fallback / scroll spy 仍可用）', () => {
    expect(tripMapRailSrc).toMatch(/useState<\{\s*lat:\s*number;\s*lng:\s*number;\s*zoom\?:\s*number\s*\}\s*\|\s*undefined>/);
  });

  it('TripMapRail listener 區分 isExpanding=true/false branch（v2.31.93 改用 focusedEntryId）', () => {
    expect(tripMapRailSrc).toMatch(/isExpanding === true/);
    expect(tripMapRailSrc).toMatch(/isExpanding === false/);
  });

  it('TripMapRail listener isExpanding undefined → 維持 v2.31.81 panTo only (no zoom)', () => {
    expect(tripMapRailSrc).toMatch(/setPanToCoord\(\{\s*lat:\s*pin\.lat,\s*lng:\s*pin\.lng\s*\}\)/);
  });

  it('OceanMap panToCoord prop type 含 optional zoom', () => {
    expect(oceanMapSrc).toMatch(/panToCoord\?:\s*\{\s*lat:\s*number;\s*lng:\s*number;\s*zoom\?:\s*number\s*\}/);
  });

  it('OceanMap panToCoord 處理：zoom given 走 flyTo，否則 panTo (no zoom change)', () => {
    expect(oceanMapSrc).toMatch(/typeof panToCoord\.zoom === 'number'[\s\S]*?flyTo\(\{\s*lat:\s*panToCoord\.lat,\s*lng:\s*panToCoord\.lng\s*\},\s*panToCoord\.zoom\)/);
    expect(oceanMapSrc).toMatch(/} else \{\s*map\.panTo\(\{\s*lat:\s*panToCoord\.lat,\s*lng:\s*panToCoord\.lng\s*\}\)/);
  });
});
