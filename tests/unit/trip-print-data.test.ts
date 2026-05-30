/**
 * PR1 (feat/trip-print-document) — print document pure helpers.
 * Design: ~/.gstack/projects/raychiutw-trip-planner/ray-master-design-20260530-101432.md
 * Mockup: docs/design-sessions/2026-05-30-trip-print-document.html (Variant A, signed off 2026-05-30)
 *
 * The print document renders from data (not the live interactive DOM), so the
 * formatting helpers are pure + unit-testable. `tripDisplayName` reuses the
 * canonical `title || name` fallback (same family as v2.34.47 trip-notes bug).
 */
import { describe, it, expect } from 'vitest';
import { tripDisplayName, formatTravelLine, formatDateRange } from '../../src/lib/tripPrintData';

describe('tripDisplayName — title || name canonical fallback', () => {
  it('uses title when present', () => {
    expect(tripDisplayName({ title: '東京自由行', name: '東京' })).toBe('東京自由行');
  });
  it('falls back to name when title is empty string (?? would miss this)', () => {
    expect(tripDisplayName({ title: '', name: '台南' })).toBe('台南');
  });
  it('falls back to name when title is null', () => {
    expect(tripDisplayName({ title: null, name: '沖繩' })).toBe('沖繩');
  });
  it('trims whitespace-only title then falls back, final-fallback when both empty', () => {
    expect(tripDisplayName({ title: '  ', name: '宜蘭' })).toBe('宜蘭');
    expect(tripDisplayName({ title: '', name: '' })).toBe('未命名行程');
  });
});

describe('formatTravelLine', () => {
  it('formats mode + min + km', () => {
    expect(formatTravelLine({ type: 'driving', min: 12, distanceM: 2100 })).toBe('開車 · 12 分 · 2.1km');
  });
  it('omits distance when absent', () => {
    expect(formatTravelLine({ type: 'walking', min: 8 })).toBe('步行 · 8 分');
  });
  it('maps transit', () => {
    expect(formatTravelLine({ type: 'transit', min: 30 })).toBe('大眾運輸 · 30 分');
  });
  it('returns empty for null / empty travel (no travel row printed)', () => {
    expect(formatTravelLine(null)).toBe('');
    expect(formatTravelLine(undefined)).toBe('');
    expect(formatTravelLine({})).toBe('');
  });
  it('passes through an unknown free-text mode', () => {
    expect(formatTravelLine({ type: '渡輪', min: 45 })).toBe('渡輪 · 45 分');
  });
});

describe('formatDateRange', () => {
  it('joins first–last day date', () => {
    expect(
      formatDateRange([
        { dayNum: 1, date: '2026-07-26', timeline: [] },
        { dayNum: 2, date: '2026-07-30', timeline: [] },
      ]),
    ).toBe('2026-07-26 – 2026-07-30');
  });
  it('single dated day → just that date', () => {
    expect(formatDateRange([{ dayNum: 1, date: '2026-07-26', timeline: [] }])).toBe('2026-07-26');
  });
  it('empty days → empty string', () => {
    expect(formatDateRange([])).toBe('');
  });
});
