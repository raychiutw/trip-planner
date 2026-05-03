/**
 * DayNav eyebrow format — 共用 MapDayTab 視覺後的對齊驗證
 *
 * 驗 contract：
 *   - eyebrow「DAY 03 · 今天」 today suffix 內嵌在 .tp-map-day-tab-eyebrow 文字內
 *   - non-today day eyebrow 純「DAY 0X」
 *   - todayDayNum 沒給 → 沒任何 day 顯示「今天」
 *   - 不再有 .dn-area / .dn-dow / .dn-today / .dn-pill 等舊 chip 殘留
 *   - 不再有自家 [data-dn] CSS hook，全用 .tp-map-day-tab*
 */
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import DayNav from '../../src/components/trip/DayNav';
import type { DaySummary } from '../../src/types/trip';

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

function eyebrowTexts(): string[] {
  return Array.from(document.querySelectorAll('.tp-map-day-tab-eyebrow'))
    .map((el) => el.textContent ?? '');
}

describe('DayNav — MapDayTab 共用視覺對齊', () => {
  it('today day eyebrow 文字含「· 今天」 suffix', () => {
    render(
      <DayNav
        days={makeDays()}
        currentDayNum={1}
        onSwitchDay={vi.fn()}
        todayDayNum={2}
      />,
    );
    const todayEyebrow = eyebrowTexts().find((t) => t.includes('今天'));
    expect(todayEyebrow).toBe('DAY 02 · 今天');
  });

  it('non-today day eyebrow 純「DAY 0X」 不含「今天」', () => {
    render(
      <DayNav
        days={makeDays()}
        currentDayNum={1}
        onSwitchDay={vi.fn()}
        todayDayNum={2}
      />,
    );
    const todayCount = eyebrowTexts().filter((t) => t.includes('今天')).length;
    expect(todayCount).toBe(1);
  });

  it('todayDayNum 沒給 → 沒任何 day 顯示「今天」', () => {
    render(
      <DayNav
        days={makeDays()}
        currentDayNum={1}
        onSwitchDay={vi.fn()}
      />,
    );
    expect(eyebrowTexts().some((t) => t.includes('今天'))).toBe(false);
  });

  it('舊 chip CSS hooks (.dn-* / [data-dn] / .ocean-day-strip) 全清', () => {
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
    expect(document.querySelector('.dn-dow')).toBeNull();
    expect(document.querySelector('.dn-area')).toBeNull();
    expect(document.querySelector('[data-dn]')).toBeNull();
    expect(document.querySelector('.ocean-day-strip')).toBeNull();
  });

  it('eyebrow 主文字為「DAY NN」 zero-pad 格式', () => {
    render(
      <DayNav
        days={makeDays()}
        currentDayNum={1}
        onSwitchDay={vi.fn()}
      />,
    );
    const texts = eyebrowTexts();
    expect(texts).toContain('DAY 01');
    expect(texts).toContain('DAY 02');
    expect(texts).toContain('DAY 03');
  });

  it('共用 .tp-map-day-tabs wrapper + sticky modifier', () => {
    render(
      <DayNav
        days={makeDays()}
        currentDayNum={1}
        onSwitchDay={vi.fn()}
      />,
    );
    const nav = document.querySelector('.tp-map-day-tabs');
    expect(nav).toBeTruthy();
    expect(nav?.classList.contains('tp-map-day-tabs--sticky')).toBe(true);
  });

  it('Trip detail 不傳 dayColor: eyebrow 無 inline color, button 無 --day-color (regression lock for v2.19.14)', () => {
    // v2.19.14 SoT: DESIGN.md L30 規範「Day palette 例外只用於地圖」, trip 明細
    // 嚴守 Terracotta 單色 accent。本 test lock DayNav 不傳 dayColor 給
    // MapDayTab — future regression (重新加 dayColor) 會被這 case 抓到。
    render(
      <DayNav
        days={makeDays()}
        currentDayNum={2}
        onSwitchDay={vi.fn()}
        todayDayNum={2}
      />,
    );
    // 所有 eyebrow span 都不應該有 inline color style
    const eyebrows = Array.from(document.querySelectorAll('.tp-map-day-tab-eyebrow'));
    for (const eyebrow of eyebrows) {
      expect(eyebrow.getAttribute('style') || '').not.toMatch(/color:/i);
    }
    // 所有 button 都不應該有 --day-color CSS var (active border-bottom 走 default accent)
    const buttons = Array.from(document.querySelectorAll('.tp-map-day-tab'));
    for (const btn of buttons) {
      expect(btn.getAttribute('style') || '').not.toMatch(/--day-color/);
    }
  });
});
