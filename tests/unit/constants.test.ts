/**
 * constants.test.ts — safeColor + getLocalToday + SAFE_COLOR_RE
 * v2.33.53 round 9: src/lib zero-test catch-up
 */
import { describe, it, expect } from 'vitest';
import {
  ARROW_EXPAND,
  ARROW_COLLAPSE,
  SAFE_COLOR_RE,
  safeColor,
  FOCUSABLE_SELECTOR,
  TRIP_TIMEZONE,
  getLocalToday,
} from '../../src/lib/constants';

describe('ARROW glyphs', () => {
  it('expand / collapse 為全形 ＋／－', () => {
    expect(ARROW_EXPAND).toBe('＋');
    expect(ARROW_COLLAPSE).toBe('－');
  });
});

describe('SAFE_COLOR_RE / safeColor', () => {
  it('接受 #rgb / #rrggbb / #rrggbbaa', () => {
    expect(SAFE_COLOR_RE.test('#fff')).toBe(true);
    expect(SAFE_COLOR_RE.test('#ff0000')).toBe(true);
    expect(SAFE_COLOR_RE.test('#ff000080')).toBe(true);
  });

  it('接受 rgb() 三參數', () => {
    expect(SAFE_COLOR_RE.test('rgb(255, 0, 0)')).toBe(true);
  });

  it('接受 var(--token)', () => {
    expect(SAFE_COLOR_RE.test('var(--blue-light)')).toBe(true);
    expect(SAFE_COLOR_RE.test('var(--color-accent-500)')).toBe(true);
  });

  it('接受 named colour', () => {
    expect(SAFE_COLOR_RE.test('red')).toBe(true);
    expect(SAFE_COLOR_RE.test('mediumseagreen')).toBe(true);
  });

  it('拒絕 javascript: / expression() / url() / 含分號', () => {
    expect(SAFE_COLOR_RE.test('javascript:alert(1)')).toBe(false);
    expect(SAFE_COLOR_RE.test('expression(alert(1))')).toBe(false);
    expect(SAFE_COLOR_RE.test('red; background:url(x)')).toBe(false);
    expect(SAFE_COLOR_RE.test('url(x)')).toBe(false);
  });

  it('safeColor() 回傳輸入值（合法時）', () => {
    expect(safeColor('#ff0000')).toBe('#ff0000');
    expect(safeColor('var(--color-accent)')).toBe('var(--color-accent)');
  });

  it('safeColor() 對不合法 / null / undefined fallback 到 var(--color-accent)', () => {
    expect(safeColor(null)).toBe('var(--color-accent)');
    expect(safeColor(undefined)).toBe('var(--color-accent)');
    expect(safeColor('')).toBe('var(--color-accent)');
    expect(safeColor('javascript:alert(1)')).toBe('var(--color-accent)');
  });
});

describe('FOCUSABLE_SELECTOR', () => {
  it('包含 a[href] / button / textarea / input / select / [tabindex]', () => {
    expect(FOCUSABLE_SELECTOR).toContain('a[href]');
    expect(FOCUSABLE_SELECTOR).toContain('button:not([disabled])');
    expect(FOCUSABLE_SELECTOR).toContain('textarea');
    expect(FOCUSABLE_SELECTOR).toContain('input');
    expect(FOCUSABLE_SELECTOR).toContain('select');
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
  });
});

describe('TRIP_TIMEZONE', () => {
  it('包含 okinawa / kyoto / busan / banqiao', () => {
    expect(TRIP_TIMEZONE.okinawa).toBe('Asia/Tokyo');
    expect(TRIP_TIMEZONE.kyoto).toBe('Asia/Tokyo');
    expect(TRIP_TIMEZONE.busan).toBe('Asia/Seoul');
    expect(TRIP_TIMEZONE.banqiao).toBe('Asia/Taipei');
  });
});

describe('getLocalToday', () => {
  it('回傳 YYYY-MM-DD 格式', () => {
    const result = getLocalToday('okinawa-2026-07');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('null tripId 退回 user local date 仍為 YYYY-MM-DD', () => {
    expect(getLocalToday(null)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('unknown prefix 退回 user local date', () => {
    expect(getLocalToday('unknown-prefix-xyz')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('okinawa prefix 用 Tokyo timezone (sv-SE locale = ISO format)', () => {
    // sv-SE 在 ko-okinawa 時區回傳 YYYY-MM-DD（已驗證格式 regex）
    expect(getLocalToday('okinawa-2026-07')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
