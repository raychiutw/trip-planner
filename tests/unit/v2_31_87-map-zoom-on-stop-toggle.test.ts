/**
 * v2.31.87 #5+#6：TimelineRail row click 展開 → map flyTo zoom 15；收合 → flyTo zoom 11。
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

  it('TripMapRail panToCoord state 接 zoom optional field', () => {
    expect(tripMapRailSrc).toMatch(/useState<\{\s*lat:\s*number;\s*lng:\s*number;\s*zoom\?:\s*number\s*\}\s*\|\s*undefined>/);
  });

  it('TripMapRail listener 區分 isExpanding=true/false 設不同 zoom', () => {
    // expand → zoom 15
    expect(tripMapRailSrc).toMatch(/isExpanding === true[\s\S]*?setPanToCoord\(\{\s*lat:\s*pin\.lat,\s*lng:\s*pin\.lng,\s*zoom:\s*15\s*\}\)/);
    // collapse → zoom 11
    expect(tripMapRailSrc).toMatch(/isExpanding === false[\s\S]*?setPanToCoord\(\{\s*lat:\s*pin\.lat,\s*lng:\s*pin\.lng,\s*zoom:\s*11\s*\}\)/);
  });

  it('TripMapRail listener isExpanding undefined → 維持 v2.31.81 panTo only (no zoom)', () => {
    expect(tripMapRailSrc).toMatch(/else \{\s*setPanToCoord\(\{\s*lat:\s*pin\.lat,\s*lng:\s*pin\.lng\s*\}\)/);
  });

  it('OceanMap panToCoord prop type 含 optional zoom', () => {
    expect(oceanMapSrc).toMatch(/panToCoord\?:\s*\{\s*lat:\s*number;\s*lng:\s*number;\s*zoom\?:\s*number\s*\}/);
  });

  it('OceanMap panToCoord 處理：zoom given 走 flyTo，否則 panTo (no zoom change)', () => {
    expect(oceanMapSrc).toMatch(/typeof panToCoord\.zoom === 'number'[\s\S]*?flyTo\(\{\s*lat:\s*panToCoord\.lat,\s*lng:\s*panToCoord\.lng\s*\},\s*panToCoord\.zoom\)/);
    expect(oceanMapSrc).toMatch(/} else \{\s*map\.panTo\(\{\s*lat:\s*panToCoord\.lat,\s*lng:\s*panToCoord\.lng\s*\}\)/);
  });
});
