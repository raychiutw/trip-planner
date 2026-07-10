/**
 * DaySection day header（v2.55.49）— 每日 custom title（trip_days.title）移除後，
 * hero 改以「日期為主標」：
 *   - eyebrow chip 顯示「DAY NN」（補零）
 *   - hero <h2> 顯示日期「YYYY-MM-DD（週）」，無 date 時 fallback「Day N」
 *   - custom title 與區域 chip（.tp-hero-chip-muted）皆已移除
 *
 * （原本測 title || label || Day N 的 fallback chain + area chip，功能已下線。）
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import DaySection from '../../src/components/trip/DaySection';
import type { Day, DaySummary } from '../../src/types/trip';

function makeDay(overrides: Partial<Day> = {}): Day {
  return { id: 1, dayNum: 3, timeline: [], hotel: null, ...overrides };
}
function makeSummary(overrides: Partial<DaySummary> = {}): DaySummary {
  return { id: 1, dayNum: 3, ...overrides };
}

const dnd = (ui: React.ReactElement) => render(<DndContext>{ui}</DndContext>);

describe('DaySection day header（v2.55.49 — 日期為主標）', () => {
  it('有 date → hero <h2> 顯示日期（含星期）', () => {
    dnd(
      <DaySection
        dayNum={3}
        day={makeDay()}
        daySummary={makeSummary({ date: '2026-07-30', dayOfWeek: '四' })}
        tripStart="2026-07-26"
        tripEnd="2026-07-31"
      />,
    );
    expect(document.querySelector('.tp-hero-title')?.textContent).toBe('2026-07-30（四）');
  });

  it('無 date → hero <h2> fallback「Day N」', () => {
    dnd(
      <DaySection
        dayNum={3}
        day={makeDay()}
        daySummary={makeSummary()}
        tripStart="2026-07-26"
        tripEnd="2026-07-31"
      />,
    );
    expect(document.querySelector('.tp-hero-title')?.textContent).toBe('Day 3');
  });

  it('eyebrow chip 顯示「DAY 03」（補零、不再含日期）', () => {
    dnd(
      <DaySection
        dayNum={3}
        day={makeDay()}
        daySummary={makeSummary({ date: '2026-07-30', dayOfWeek: '四' })}
        tripStart="2026-07-26"
        tripEnd="2026-07-31"
      />,
    );
    expect(document.querySelector('.tp-hero-chip')?.textContent).toBe('DAY 03');
  });

  it('custom title 移除後：無區域 chip（.tp-hero-chip-muted）', () => {
    dnd(
      <DaySection
        dayNum={3}
        day={makeDay()}
        daySummary={makeSummary({ label: '美瑛', date: '2026-07-30', dayOfWeek: '四' })}
        tripStart="2026-07-26"
        tripEnd="2026-07-31"
      />,
    );
    expect(document.querySelectorAll('.tp-hero-chip-muted').length).toBe(0);
  });
});
