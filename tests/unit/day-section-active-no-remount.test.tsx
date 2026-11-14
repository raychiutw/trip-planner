/**
 * #1719：某天變成目前天時只重播進場動畫，不能用換 key 的方式把整天的時間軸卸載重建
 * （會吃掉剛打開的選單與鍵盤焦點；CI WebKit 右鍵選單測試時紅時綠的根因）。
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import DaySection from '../../src/components/trip/DaySection';
import type { Day, DaySummary } from '../../src/types/trip';

const day: Day = { id: 1, dayNum: 1, timeline: [], hotel: null };
const summary: DaySummary = { id: 1, dayNum: 1 };
const ui = (isActive: boolean) => (
  <DndContext><DaySection dayNum={1} day={day} daySummary={summary} isActive={isActive} /></DndContext>
);

describe('DaySection 變成目前天', () => {
  it('內容節點保持同一個，並加上進場動畫 class', () => {
    const { rerender } = render(ui(false));
    const before = document.getElementById('day-slot-1');
    expect(before).not.toBeNull();
    rerender(ui(true));
    const after = document.getElementById('day-slot-1');
    expect(after).toBe(before);
    expect(after!.classList.contains('day-content-enter')).toBe(true);
  });

  it('再次離開又回來：節點仍是同一個', () => {
    const { rerender } = render(ui(true));
    const first = document.getElementById('day-slot-1');
    rerender(ui(false));
    rerender(ui(true));
    expect(document.getElementById('day-slot-1')).toBe(first);
  });
});
