/**
 * day-section-no-inline-style.test.tsx — F002 TDD red test
 *
 * 驗證：DaySection render 後的 DOM 中 ocean-hero-chips 區域
 * 不含 style="..." attribute（靜態 layout style 應移至 CSS class）。
 *
 * 允許例外：有 dynamic value 的 inline style（若存在）
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DaySection from '../../src/components/trip/DaySection';
import type { Day, DaySummary } from '../../src/types/trip';

const mockDay: Day = {
  id: 1,
  label: '那霸市區',
  date: '2026-07-27',
  hotel: null,
  timeline: [],
};

const mockDaySummary: DaySummary = {
  date: '2026-07-27',
  dayOfWeek: '日',
  label: '那霸市區',
};

function renderDay() {
  return render(
    <MemoryRouter initialEntries={['/trip/test-trip']}>
      <DaySection
        dayNum={1}
        day={mockDay}
        daySummary={mockDaySummary}
        tripStart="2026-07-27"
        tripEnd="2026-07-30"
        isActive={false}
      />
    </MemoryRouter>,
  );
}

describe('DaySection — ocean-hero-chips 無靜態 inline style (F002)', () => {
  it('ocean-hero-chips div 不含 style attribute（靜態 layout 已移至 CSS class）', () => {
    const { container } = renderDay();
    const chipsDiv = container.querySelector('.ocean-hero-chips');
    expect(chipsDiv).not.toBeNull();
    // 靜態 layout style 不應以 inline style 形式存在
    const styleAttr = chipsDiv?.getAttribute('style');
    expect(styleAttr).toBeNull();
  });

  it('ocean-hero-chips 的直接子 div 不含靜態 layout inline style', () => {
    const { container } = renderDay();
    const chipsDiv = container.querySelector('.ocean-hero-chips');
    const innerDiv = chipsDiv?.querySelector('div');
    expect(innerDiv).not.toBeNull();
    const styleAttr = innerDiv?.getAttribute('style');
    expect(styleAttr).toBeNull();
  });
});
