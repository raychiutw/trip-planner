/**
 * DayNav eyebrow format — Section 4.4 (terracotta-mockup-parity-v2)
 *
 * 驗 mockup 對齊改動：
 *   - eyebrow「DAY 03 · 今天」 today suffix 取代獨立 TODAY pill
 *   - 拿掉 .dn-dow 週幾英文 extra row
 *   - non-today day eyebrow 純「DAY 0X」
 *   - area 仍渲染為 .dn-area
 */
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import DayNav from '../../src/components/trip/DayNav';
import type { DaySummary } from '../../src/types/trip';

// jsdom 缺 Element.scrollTo，DayNav 在 mount 後對 nav container 呼叫
// scrollTo({ left, behavior }) — 補上 noop 避免 ReactDOM commit 階段 throw。
beforeAll(() => {
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = (() => {}) as Element['scrollTo'];
  }
});

function makeDays(): DaySummary[] {
  return [
    { id: 1, dayNum: 1, date: '2026-04-26', dayOfWeek: 'Sun', label: '那霸' },
    { id: 2, dayNum: 2, date: '2026-04-27', dayOfWeek: 'Mon', label: '美瑛' },
    { id: 3, dayNum: 3, date: '2026-04-28', dayOfWeek: 'Tue', label: '富良野' },
  ];
}

describe('DayNav eyebrow — Section 4.4 mockup parity', () => {
  it('today day eyebrow 含「· 今天」 suffix', () => {
    render(
      <DayNav
        days={makeDays()}
        currentDayNum={1}
        onSwitchDay={vi.fn()}
        todayDayNum={2}
      />,
    );
    const todaySuffix = document.querySelector('.dn-eyebrow-today');
    expect(todaySuffix).toBeTruthy();
    expect(todaySuffix?.textContent).toContain('今天');
  });

  it('non-today day eyebrow 不含「· 今天」', () => {
    render(
      <DayNav
        days={makeDays()}
        currentDayNum={1}
        onSwitchDay={vi.fn()}
        todayDayNum={2}
      />,
    );
    const todaySuffixCount = document.querySelectorAll('.dn-eyebrow-today');
    // 整個 nav 應該只有「Day 2」一個 eyebrow 含 today
    expect(todaySuffixCount.length).toBe(1);
  });

  it('todayDayNum 沒給 → 沒任何 day 顯示「今天」', () => {
    render(
      <DayNav
        days={makeDays()}
        currentDayNum={1}
        onSwitchDay={vi.fn()}
      />,
    );
    expect(document.querySelector('.dn-eyebrow-today')).toBeNull();
  });

  it('TODAY pill (.dn-today / .dn-pill) 被拿掉，只用 eyebrow suffix', () => {
    render(
      <DayNav
        days={makeDays()}
        currentDayNum={2}
        onSwitchDay={vi.fn()}
        todayDayNum={2}
      />,
    );
    expect(document.querySelector('.dn-today')).toBeNull();
    expect(document.querySelector('.dn-pill')).toBeNull();
  });

  it('.dn-dow 週幾英文 extra row 已移除', () => {
    render(
      <DayNav
        days={makeDays()}
        currentDayNum={1}
        onSwitchDay={vi.fn()}
      />,
    );
    expect(document.querySelector('.dn-dow')).toBeNull();
  });

  it('area label 仍渲染為 .dn-area', () => {
    render(
      <DayNav
        days={makeDays()}
        currentDayNum={1}
        onSwitchDay={vi.fn()}
      />,
    );
    const areas = Array.from(document.querySelectorAll('.dn-area')).map((el) => el.textContent);
    expect(areas).toContain('那霸');
    expect(areas).toContain('美瑛');
    expect(areas).toContain('富良野');
  });

  it('eyebrow 主文字為「DAY NN」 zero-pad 格式', () => {
    render(
      <DayNav
        days={makeDays()}
        currentDayNum={1}
        onSwitchDay={vi.fn()}
        todayDayNum={2}
      />,
    );
    const eyebrows = Array.from(document.querySelectorAll('.dn-eyebrow'))
      .map((el) => (el.firstChild?.textContent ?? '').trim());
    expect(eyebrows).toContain('DAY 01');
    expect(eyebrows).toContain('DAY 02');
    expect(eyebrows).toContain('DAY 03');
  });
});
