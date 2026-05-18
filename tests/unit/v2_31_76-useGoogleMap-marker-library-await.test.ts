/**
 * v2.31.76 hotfix: useGoogleMap must `await importLibrary('marker')` in
 * addition to 'maps' before exposing the map instance — otherwise
 * `google.maps.marker.AdvancedMarkerElement` is undefined when OceanMap /
 * MapFabs render and the whole map enters ErrorBoundary.
 *
 * Source-grep style — locks the two `importLibrary` call sites in
 * `src/hooks/useGoogleMap.ts` so future refactors can't drop 'marker'
 * silently.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('v2.31.76: useGoogleMap awaits marker library before setMap', () => {
  const src = readFileSync(
    join(__dirname, '../../src/hooks/useGoogleMap.ts'),
    'utf8',
  );

  it("calls importLibrary('maps')", () => {
    expect(src).toMatch(/importLibrary\(['"]maps['"]\)/);
  });

  it("calls importLibrary('marker')", () => {
    expect(src).toMatch(/importLibrary\(['"]marker['"]\)/);
  });

  it('awaits BOTH libraries via Promise.all before setMap fires', () => {
    // Either Promise.all([...maps..., ...marker...]) OR sequential await.
    // Lock the Promise.all idiom since it's parallel & explicit.
    expect(src).toMatch(
      /Promise\.all\(\[\s*importLibrary\(['"]maps['"]\)\s*,\s*importLibrary\(['"]marker['"]\)\s*\]\)/,
    );
  });

  it('library list in setOptions still declares both', () => {
    expect(src).toMatch(/libraries:\s*\[\s*['"]maps['"]\s*,\s*['"]marker['"]\s*\]/);
  });
});
