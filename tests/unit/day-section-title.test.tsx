/**
 * DaySection day title fallback — Section 4.3 (terracotta-mockup-parity-v2)
 *
 * 驗 hero <h2> 顯示優先順序：
 *   1. day.title (user 命名)
 *   2. daySummary.label (區域名)
 *   3. `Day N` fallback
 *
 * 同 area chip：title === area 時不重複顯示 chip-muted。
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import DaySection from '../../src/components/trip/DaySection';
import type { Day, DaySummary } from '../../src/types/trip';

function makeDay(overrides: Partial<Day> = {}): Day {
  return {
    id: 1,
    dayNum: 3,
    timeline: [],
    hotel: null,
    ...overrides,
  };
}

function makeSummary(overrides: Partial<DaySummary> = {}): DaySummary {
  return {
    id: 1,
    dayNum: 3,
    ...overrides,
  };
}

describe('DaySection day title fallback', () => {
  it('day.title 存在 → 顯示 title', () => {
    render(
      <DndContext><DaySection
        dayNum={3}
        day={makeDay({ title: '美瑛拼布之路' })}
        daySummary={makeSummary({ label: '美瑛' })}
        tripStart="2026-04-26"
        tripEnd="2026-04-30"
      /></DndContext>,
    );
    const heroTitle = document.querySelector('.tp-hero-title');
    expect(heroTitle?.textContent).toBe('美瑛拼布之路');
  });

  it('無 title 但有 area label → 顯示 label', () => {
    render(
      <DndContext><DaySection
        dayNum={3}
        day={makeDay({ title: null })}
        daySummary={makeSummary({ label: '那霸' })}
        tripStart="2026-04-26"
        tripEnd="2026-04-30"
      /></DndContext>,
    );
    const heroTitle = document.querySelector('.tp-hero-title');
    expect(heroTitle?.textContent).toBe('那霸');
  });

  it('title + label 都無 → fallback「Day N」', () => {
    render(
      <DndContext><DaySection
        dayNum={3}
        day={makeDay()}
        daySummary={makeSummary()}
        tripStart="2026-04-26"
        tripEnd="2026-04-30"
      /></DndContext>,
    );
    const heroTitle = document.querySelector('.tp-hero-title');
    expect(heroTitle?.textContent).toBe('Day 3');
  });

  it('title === area → area chip 不重複渲染', () => {
    render(
      <DndContext><DaySection
        dayNum={3}
        day={makeDay({ title: '美瑛' })}
        daySummary={makeSummary({ label: '美瑛' })}
        tripStart="2026-04-26"
        tripEnd="2026-04-30"
      /></DndContext>,
    );
    const chips = document.querySelectorAll('.tp-hero-chip-muted');
    expect(chips.length).toBe(0);
  });

  it('title !== area → area chip 仍渲染', () => {
    render(
      <DndContext><DaySection
        dayNum={3}
        day={makeDay({ title: '美瑛拼布之路' })}
        daySummary={makeSummary({ label: '美瑛' })}
        tripStart="2026-04-26"
        tripEnd="2026-04-30"
      /></DndContext>,
    );
    const chip = document.querySelector('.tp-hero-chip-muted');
    expect(chip?.textContent).toBe('美瑛');
  });

  it('day.title 是空白字串 → 視為無 title 走 fallback', () => {
    render(
      <DndContext><DaySection
        dayNum={3}
        day={makeDay({ title: '   ' })}
        daySummary={makeSummary({ label: '那霸' })}
        tripStart="2026-04-26"
        tripEnd="2026-04-30"
      /></DndContext>,
    );
    const heroTitle = document.querySelector('.tp-hero-title');
    expect(heroTitle?.textContent).toBe('那霸');
  });
});
