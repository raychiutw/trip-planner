/**
 * useGoogleMap — Google POI click wiring (owner 2026-07-21 地圖點選 Google 原生 POI).
 *
 * Source-grep style, matching the existing v2_31_76-useGoogleMap-marker-library-await.test.ts
 * convention for this same file: the hook's real behaviour is an async
 * effect around a mocked `@googlemaps/js-api-loader` + `google.maps.Map`
 * instance, which every other test in this codebase avoids exercising
 * end-to-end (component tests mock TpMap wholesale instead — see
 * map-page-overview-runtime.test.tsx). This locks the specific wiring so a
 * future refactor can't silently drop it:
 *   - clickableIcons defaults to false (LocationPickerMap / other callers
 *     unaffected — only callers that explicitly opt in get native POI taps)
 *   - a 'click' listener is registered on the map instance
 *   - classifyMapClick (pure helper, see mapHelpers.ts) does the
 *     poi-vs-background split, not ad-hoc inline logic
 *   - the click listener is torn down on unmount (no leak)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(__dirname, '../../src/hooks/useGoogleMap.ts'),
  'utf8',
);

describe('useGoogleMap: Google POI click wiring', () => {
  it('clickableIcons option defaults to false (existing callers unaffected)', () => {
    expect(src).toMatch(/clickableIcons\s*=\s*false/);
  });

  it('imports classifyMapClick from mapHelpers (reuse pure helper, not inline logic)', () => {
    expect(src).toMatch(/import\s*\{[^}]*classifyMapClick[^}]*\}\s*from\s*['"]\.\.\/lib\/mapHelpers['"]/);
  });

  it('registers a click listener on the map instance', () => {
    expect(src).toMatch(/instance\.addListener\(\s*['"]click['"]/);
  });

  it('removes the click listener on cleanup (no leak across mount/unmount)', () => {
    expect(src).toMatch(/clickListener(Handle)?\??\.remove\(\)/);
  });

  it('exposes onPoiClick + onMapClick in UseGoogleMapOptions', () => {
    expect(src).toMatch(/onPoiClick\?:/);
    expect(src).toMatch(/onMapClick\?:/);
  });
});
