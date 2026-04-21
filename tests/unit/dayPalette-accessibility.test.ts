/**
 * dayPalette-accessibility.test.ts — F008 TDD red test
 *
 * 驗證 dayPolylineStyle 函式存在，且奇數/偶數天的 dashArray 不同，
 * 確保色盲使用者可透過線型區分不同天的路線。
 */

import { describe, it, expect } from 'vitest';

describe('F008 — dayPolylineStyle color-blind aid', () => {
  it('dayPolylineStyle 函式存在', async () => {
    const mod = await import('../../src/lib/dayPalette');
    expect(typeof mod.dayPolylineStyle).toBe('function');
  });

  it('奇數天（day 1）與偶數天（day 2）的 dashArray 不同', async () => {
    const { dayPolylineStyle } = await import('../../src/lib/dayPalette');
    const day1 = dayPolylineStyle(1);
    const day2 = dayPolylineStyle(2);
    expect(day1.dashArray).not.toEqual(day2.dashArray);
  });

  it('奇數天 dashArray 為 undefined（solid line）', async () => {
    const { dayPolylineStyle } = await import('../../src/lib/dayPalette');
    expect(dayPolylineStyle(1).dashArray).toBeUndefined();
    expect(dayPolylineStyle(3).dashArray).toBeUndefined();
  });

  it('偶數天 dashArray 為非 undefined（dashed line）', async () => {
    const { dayPolylineStyle } = await import('../../src/lib/dayPalette');
    expect(dayPolylineStyle(2).dashArray).toBeDefined();
    expect(dayPolylineStyle(4).dashArray).toBeDefined();
  });

  it('回傳的 color 是非空字串', async () => {
    const { dayPolylineStyle } = await import('../../src/lib/dayPalette');
    const style = dayPolylineStyle(1);
    expect(typeof style.color).toBe('string');
    expect(style.color.length).toBeGreaterThan(0);
  });

  it('color 與 dayColor 一致', async () => {
    const { dayPolylineStyle, dayColor } = await import('../../src/lib/dayPalette');
    for (let d = 1; d <= 10; d++) {
      expect(dayPolylineStyle(d).color).toBe(dayColor(d));
    }
  });
});
