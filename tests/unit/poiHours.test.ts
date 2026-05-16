/**
 * poiHours — condenseHours() unit tests.
 */
import { describe, it, expect } from 'vitest';
import { condenseHours } from '../../src/lib/poiHours';

describe('condenseHours', () => {
  it('empty input → empty string', () => {
    expect(condenseHours(null)).toBe('');
    expect(condenseHours(undefined)).toBe('');
    expect(condenseHours('')).toBe('');
    expect(condenseHours('   ')).toBe('');
  });

  it('non-weekly string → 原字串 (fallback)', () => {
    expect(condenseHours('09:00–17:00')).toBe('09:00–17:00');
    expect(condenseHours('需預約')).toBe('需預約');
    expect(condenseHours('11:00 - 14:30, 17:00 - 22:00')).toBe('11:00 - 14:30, 17:00 - 22:00');
  });

  it('7 天時段全相同 → 單一 range', () => {
    const raw = `星期一: 08:00–17:30
星期二: 08:00–17:30
星期三: 08:00–17:30
星期四: 08:00–17:30
星期五: 08:00–17:30
星期六: 08:00–17:30
星期日: 08:00–17:30`;
    expect(condenseHours(raw)).toBe('08:00–17:30');
  });

  it('全週相同（半形空格 + 連字符）→ 單一 range', () => {
    const raw = '星期一: 08:00 – 17:30 星期二: 08:00 – 17:30 星期三: 08:00 – 17:30 星期四: 08:00 – 17:30 星期五: 08:00 – 17:30 星期六: 08:00 – 17:30 星期日: 08:00 – 17:30';
    expect(condenseHours(raw)).toBe('08:00 – 17:30');
  });

  it('平日同 + 週末同（不同時段）→ 週一–五 X · 週末 Y', () => {
    const raw = `星期一: 09:00–18:00
星期二: 09:00–18:00
星期三: 09:00–18:00
星期四: 09:00–18:00
星期五: 09:00–18:00
星期六: 10:00–22:00
星期日: 10:00–22:00`;
    expect(condenseHours(raw)).toBe('週一–五 09:00–18:00 · 週末 10:00–22:00');
  });

  it('全週分散時段 → 原字串 (fallback，無法壓縮)', () => {
    const raw = `星期一: 08:00–17:30
星期二: 08:00–17:30
星期三: 休息
星期四: 08:00–17:30
星期五: 08:00–17:30
星期六: 10:00–20:00
星期日: 10:00–20:00`;
    expect(condenseHours(raw)).toContain('星期一');
    expect(condenseHours(raw)).toContain('休息');
  });

  it('「星期天」alias → 視同「星期日」', () => {
    const raw = `星期一: 08:00–17:30
星期二: 08:00–17:30
星期三: 08:00–17:30
星期四: 08:00–17:30
星期五: 08:00–17:30
星期六: 08:00–17:30
星期天: 08:00–17:30`;
    expect(condenseHours(raw)).toBe('08:00–17:30');
  });

  it('少於 5 天時段（partial schedule）→ 原字串', () => {
    const raw = '星期一: 08:00–17:30 星期二: 08:00–17:30';
    expect(condenseHours(raw)).toBe(raw);
  });
});
