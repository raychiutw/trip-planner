/**
 * W11 · TripTimePicker「12/24 跟系統」（Intl hourCycle）換算 —— 邊角是 12AM/12PM。
 *
 * 儲存永遠 24h "HH:MM"；只有顯示 + picker 欄依系統 12/24。這裡鎖 24h↔12h+period 換算
 * 與顯示格式化，特別是 12 點的兩個陷阱（00:00=12 AM、12:00=12 PM）。
 */
import { describe, it, expect } from 'vitest';
import { to12h, to24h, formatTimeDisplay } from '../../src/components/TripTimePicker';

describe('to12h — 24h → 12h + period', () => {
  const cases: Array<[string, string, 'AM' | 'PM']> = [
    ['00', '12', 'AM'], // 午夜 12 AM
    ['01', '01', 'AM'],
    ['11', '11', 'AM'],
    ['12', '12', 'PM'], // 正午 12 PM
    ['13', '01', 'PM'],
    ['23', '11', 'PM'],
  ];
  for (const [hh24, h12, period] of cases) {
    it(`${hh24} → ${h12} ${period}`, () => {
      expect(to12h(hh24)).toEqual({ h12, period });
    });
  }
});

describe('to24h — 12h + period → 24h', () => {
  const cases: Array<['AM' | 'PM', string, string]> = [
    ['AM', '12', '00'], // 12 AM = 午夜
    ['AM', '01', '01'],
    ['AM', '11', '11'],
    ['PM', '12', '12'], // 12 PM = 正午
    ['PM', '01', '13'],
    ['PM', '11', '23'],
  ];
  for (const [period, h12, hh24] of cases) {
    it(`${h12} ${period} → ${hh24}`, () => {
      expect(to24h(h12, period)).toBe(hh24);
    });
  }
});

describe('round-trip — 每個 00..23 經 12h 再回來不變', () => {
  it('to24h(to12h(hh)) === hh，全 24 小時', () => {
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, '0');
      const { h12, period } = to12h(hh);
      expect(to24h(h12, period)).toBe(hh);
    }
  });
});

describe('formatTimeDisplay', () => {
  it('24h：原樣 "HH:MM"', () => {
    expect(formatTimeDisplay('13', '30', false)).toBe('13:30');
    expect(formatTimeDisplay('00', '05', false)).toBe('00:05');
  });
  it('12h：無前導零 + AM/PM', () => {
    expect(formatTimeDisplay('13', '30', true)).toBe('1:30 PM');
    expect(formatTimeDisplay('00', '05', true)).toBe('12:05 AM');
    expect(formatTimeDisplay('12', '00', true)).toBe('12:00 PM');
    expect(formatTimeDisplay('09', '15', true)).toBe('9:15 AM');
  });
});
