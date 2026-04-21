/**
 * dayPalette.test.ts — TDD Red tests for Item 5: 10-colour Day Palette
 *
 * Red: import from path that does not yet exist → all tests fail on import.
 * Green: create src/lib/dayPalette.ts to pass.
 */

import { describe, it, expect } from 'vitest';
import { DAY_PALETTE, dayColor } from '../../src/lib/dayPalette';

describe('DAY_PALETTE', () => {
  it('has exactly 10 colours', () => {
    expect(DAY_PALETTE).toHaveLength(10);
  });

  it('all entries are non-empty hex strings', () => {
    for (const c of DAY_PALETTE) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('dayColor', () => {
  it('day 1 returns index 0 (sky-500)', () => {
    expect(dayColor(1)).toBe(DAY_PALETTE[0]);
  });

  it('day 10 returns index 9 (emerald-500)', () => {
    expect(dayColor(10)).toBe(DAY_PALETTE[9]);
  });

  it('day 11 wraps back to index 0', () => {
    expect(dayColor(11)).toBe(DAY_PALETTE[0]);
  });

  it('day 20 wraps back to index 9', () => {
    expect(dayColor(20)).toBe(DAY_PALETTE[9]);
  });

  it('day 21 wraps back to index 0', () => {
    expect(dayColor(21)).toBe(DAY_PALETTE[0]);
  });

  // PR3 review fix #1: guard against invalid inputs
  it('dayColor(0) returns DAY_PALETTE[0] (guard: dayNum < 1)', () => {
    expect(dayColor(0)).toBe(DAY_PALETTE[0]);
  });

  it('dayColor(-1) returns DAY_PALETTE[0] (guard: negative dayNum)', () => {
    expect(dayColor(-1)).toBe(DAY_PALETTE[0]);
  });

  it('dayColor(NaN) returns DAY_PALETTE[0] (guard: NaN)', () => {
    expect(dayColor(NaN)).toBe(DAY_PALETTE[0]);
  });

  it('dayColor(Infinity) returns DAY_PALETTE[0] (guard: Infinity)', () => {
    expect(dayColor(Infinity)).toBe(DAY_PALETTE[0]);
  });
});
