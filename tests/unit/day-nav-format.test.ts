import { describe, it, expect } from 'vitest';
import { formatPillLabel } from '../../src/components/trip/DayNav';

describe('formatPillLabel', () => {
  it('無 date 時 fallback 為 dayNum 字串', () => {
    expect(formatPillLabel({ dayNum: 3, date: null })).toBe('3');
  });

  it('合法日期輸出 M/D 無補零', () => {
    expect(formatPillLabel({ dayNum: 3, date: '2026-07-26' })).toBe('7/26');
    expect(formatPillLabel({ dayNum: 5, date: '2026-01-05' })).toBe('1/5');
  });

  it('非法日期時 fallback 為 dayNum', () => {
    expect(formatPillLabel({ dayNum: 7, date: 'bad-date' })).toBe('7');
  });
});
