/**
 * no-inline-day-map.test.tsx — TDD tests for Item 4:
 * DaySection must NOT contain <OceanMap mode="overview"> inline map.
 *
 * Covers:
 * - DaySection source code has no OceanMap import used inline
 * - The "看地圖" link chip is present instead (Item 6)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const DAY_SECTION_PATH = resolve(__dirname, '../../src/components/trip/DaySection.tsx');
const source = readFileSync(DAY_SECTION_PATH, 'utf-8');

describe('DaySection — no inline OceanMap map (Item 4)', () => {
  it('does not render <OceanMap mode="overview"> inline', () => {
    // After PR3, the inline map block is removed
    expect(source).not.toContain('<OceanMap');
  });

  it('does not contain hideDayMap prop usage for inline map rendering', () => {
    // The hideDayMap flag gated the old inline OceanMap render
    expect(source).not.toContain('hideDayMap');
  });

  it('does not contain OceanMap lazy import', () => {
    // lazy(() => import('./OceanMap')) should be removed from DaySection
    expect(source).not.toContain("import('./OceanMap')");
  });
});

describe('DaySection — 看地圖 chip present (Item 6)', () => {
  it('contains a link to the map page with day query', () => {
    // The chip links to /trip/:id/map?day=N
    expect(source).toContain('/map?day=');
  });

  it('contains 看地圖 text', () => {
    expect(source).toContain('看地圖');
  });
});
