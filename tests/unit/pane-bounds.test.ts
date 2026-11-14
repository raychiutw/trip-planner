import { describe, it, expect } from 'vitest';
import { paneBounds, MIN_MAIN_PX, MIN_SHEET_PX } from '../../src/components/shell/usePaneDivider';

describe('paneBounds', () => {
  it('量不到寬度退回 0–100', () => expect(paneBounds(0)).toEqual({ min: 0, max: 100 }));
  it('1000px：中欄 400／右欄 360 → 40–64', () => {
    const b = paneBounds(1000);
    expect(b.min).toBeCloseTo(40); expect(b.max).toBeCloseTo(64);
  });
  it('窄到放不下兩個最小寬：max 不小於 min', () => {
    const b = paneBounds(MIN_MAIN_PX + MIN_SHEET_PX - 100);
    expect(b.max).toBeGreaterThanOrEqual(b.min);
  });
});
