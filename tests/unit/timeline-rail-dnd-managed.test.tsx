/**
 * TimelineRail dndManaged 雙模（2026-07-07 跨天拖拉）
 *
 * managed = TripPage 統一 DndContext：rail 不自建 context（嵌套會搶事件），
 * 改掛 useDndMonitor 接同日 reorder。獨立頁（預設）自建 context 原行為。
 *
 * 驗：managed 模式在外層 DndContext 下正常 render items；
 *     非 managed（既有測試盲跑多年的預設路徑）此檔補明示斷言。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DndContext } from '@dnd-kit/core';
import TimelineRail from '../../src/components/trip/TimelineRail';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';
import { TripIdContext } from '../../src/contexts/TripIdContext';

const useTripSegmentsMock = vi.fn();
vi.mock('../../src/hooks/useTripSegments', () => ({
  useTripSegments: (tripId: string | null | undefined) => useTripSegmentsMock(tripId),
}));
vi.mock('../../src/lib/travelRecompute', () => ({
  requestTravelRecompute: vi.fn(() => Promise.resolve(null)),
}));

beforeEach(() => {
  useTripSegmentsMock.mockReset();
  useTripSegmentsMock.mockReturnValue({ segments: [], segmentMap: new Map(), loading: false, ready: false });
});

function entry(id: number, title: string): TimelineEntryData {
  return { id, time: '09:00-10:00', title, description: null, note: null, googleRating: null };
}

describe('TimelineRail dndManaged 雙模', () => {
  it('managed：外層 DndContext 下 render items 正常（rail 不自建 context）', () => {
    render(
      <MemoryRouter>
        <TripIdContext.Provider value="t1">
          <DndContext>
            <TimelineRail events={[entry(1, '那霸機場'), entry(2, '美麗海')]} dayId={55} dndManaged />
          </DndContext>
        </TripIdContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('timeline-rail-row-1')).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-row-2')).toBeTruthy();
  });

  it('非 managed（預設）：獨立 render 正常（自建 context 原行為）', () => {
    render(
      <MemoryRouter>
        <TripIdContext.Provider value="t1">
          <TimelineRail events={[entry(1, '那霸機場')]} dayId={55} />
        </TripIdContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('timeline-rail-row-1')).toBeTruthy();
  });

  it('managed 空日 → render 空 drop 槽（拖到還沒排的天）；非 managed 空日 → null', () => {
    const { container, unmount } = render(
      <MemoryRouter>
        <TripIdContext.Provider value="t1">
          <DndContext>
            <TimelineRail events={[]} dayId={55} dndManaged />
          </DndContext>
        </TripIdContext.Provider>
      </MemoryRouter>,
    );
    expect(container.querySelector('.tp-rail-body.is-empty-day')).toBeTruthy();
    unmount();

    const { container: c2 } = render(
      <MemoryRouter>
        <TripIdContext.Provider value="t1">
          <TimelineRail events={[]} dayId={55} />
        </TripIdContext.Provider>
      </MemoryRouter>,
    );
    expect(c2.querySelector('.tp-rail')).toBeNull();
  });
});
