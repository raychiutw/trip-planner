/**
 * #1262 — 拆檔後的 RailRow / EntryTimeChip / StopPoiChoiceCard 各自可 render、
 * 互動只呼叫 entry 變更 module 的動詞（fake module），不碰 fetch / event / 車程 helper。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mutations = vi.hoisted(() => ({
  setMaster: vi.fn(async () => ({ ok: true, data: undefined, recompute: Promise.resolve(true) })),
  updateEntry: vi.fn(async () => ({ ok: true, data: {}, recompute: Promise.resolve(true) })),
  updateEntryPoi: vi.fn(async () => ({ ok: true, data: {}, recompute: Promise.resolve(true) })),
  deleteEntry: vi.fn(async () => ({ ok: true, data: undefined, recompute: Promise.resolve(true) })),
  reorderEntries: vi.fn(async () => ({ ok: true, data: undefined, recompute: Promise.resolve(true) })),
}));
vi.mock('../../src/lib/entryMutations', () => mutations);
vi.mock('../../src/components/shared/Toast', () => ({ showToast: vi.fn() }));
vi.mock('../../src/hooks/useTripSegments', () => ({
  useTripSegments: () => ({ segments: [], segmentMap: new Map(), loading: false }),
}));

import { EntryTimeChip } from '../../src/components/trip/EntryTimeChip';
import { StopPoiChoiceCard } from '../../src/components/trip/StopPoiChoiceCard';
import { RailRow } from '../../src/components/trip/RailRow';
import { TripIdContext } from '../../src/contexts/TripIdContext';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';

beforeEach(() => { Object.values(mutations).forEach((m) => m.mockClear()); });

function pickIn(label: string, hh: string, mm: string) {
  const trigger = screen.getByLabelText(label);
  fireEvent.click(trigger);
  fireEvent.click(document.querySelector<HTMLElement>(`[data-h="${hh}"]`)!);
  fireEvent.click(trigger);
  fireEvent.click(document.querySelector<HTMLElement>(`[data-m="${mm}"]`)!);
}

describe('EntryTimeChip（獨立 render）', () => {
  it('改抵達時間 → 完成 → 只呼叫 updateEntry(tripId, entryId, dayNum, { start_time })', async () => {
    render(<EntryTimeChip tripId="t1" entryId={42} dayNum={1} start="13:00" end="14:00" />);
    fireEvent.click(screen.getByTestId('timeline-rail-time-chip-42'));
    pickIn('抵達時間', '09', '30');
    fireEvent.click(screen.getByText('完成'));
    await waitFor(() => expect(mutations.updateEntry).toHaveBeenCalledTimes(1));
    expect(mutations.updateEntry).toHaveBeenCalledWith('t1', 42, 1, { start_time: '09:30' });
  });
  it('沒改 → Escape 關閉，不呼叫 module', () => {
    render(<EntryTimeChip tripId="t1" entryId={42} dayNum={1} start="13:00" end="14:00" />);
    fireEvent.click(screen.getByTestId('timeline-rail-time-chip-42'));
    fireEvent.keyDown(screen.getByRole('dialog', { name: '起訖時間' }), { key: 'Escape' });
    expect(mutations.updateEntry).not.toHaveBeenCalled();
  });
});

describe('StopPoiChoiceCard（獨立 render）', () => {
  it('備選卡「設為正選」→ setMaster(tripId, entryId, dayNum, poiId)', async () => {
    render(<StopPoiChoiceCard tripId="t1" entryId={42} dayNum={2} poi={{ poiId: 9002, sortOrder: 2, name: '泊港漁市場', type: 'shopping' }} />);
    fireEvent.click(screen.getByTestId('timeline-rail-set-master-42-9002'));
    await waitFor(() => expect(mutations.setMaster).toHaveBeenCalledWith('t1', 42, 2, 9002));
  });
});

describe('RailRow（獨立 render）', () => {
  const entry: TimelineEntryData = {
    id: 42, startTime: '13:00', endTime: '14:00', title: '糸滿魚市場',
    stopPois: [{ poiId: 9001, sortOrder: 1, name: '糸滿魚市場' }, { poiId: 9002, sortOrder: 2, name: '泊港漁市場', type: 'shopping' }],
  };
  it('render 一列 + 時間 chip；展開後含備選卡並可設為正選（動詞來自 module）', async () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <MemoryRouter><TripIdContext.Provider value="t1">
        <RailRow entry={entry} index={0} expanded={false} onToggle={onToggle} isPast={false} isNow={false} isLast sortMode={false} onEnterSortMode={() => {}} stopNumber={1} />
      </TripIdContext.Provider></MemoryRouter>,
    );
    expect(screen.getByTestId('timeline-rail-row-42')).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-time-chip-42')).toBeTruthy();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    expect(onToggle).toHaveBeenCalled();
    rerender(
      <MemoryRouter><TripIdContext.Provider value="t1">
        <RailRow entry={entry} index={0} expanded onToggle={onToggle} isPast={false} isNow={false} isLast sortMode={false} onEnterSortMode={() => {}} stopNumber={1} />
      </TripIdContext.Provider></MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('timeline-rail-set-master-42-9002'));
    await waitFor(() => expect(mutations.setMaster).toHaveBeenCalled());
  });
});

describe('RailRow ⋯ menu 條件分支', () => {
  const base: TimelineEntryData = { id: 7, startTime: '09:00', endTime: '10:00', title: '首里城', stopPois: [{ poiId: 1, sortOrder: 1, name: '首里城' }] };
  function renderRow(entry: TimelineEntryData, extra: Partial<React.ComponentProps<typeof RailRow>> = {}) {
    return render(
      <MemoryRouter><TripIdContext.Provider value="t1">
        <RailRow entry={entry} index={0} expanded={false} onToggle={() => {}} isPast={false} isNow={false} isLast sortMode={false} onEnterSortMode={() => {}} stopNumber={1} {...extra} />
      </TripIdContext.Provider></MemoryRouter>,
    );
  }
  it('無地點 → 沒有「在地圖開啟」；第一列且非末列 → 只有下移沒有上移', () => {
    renderRow(base, { onMoveStep: () => {}, isLast: false });
    fireEvent.click(screen.getByTestId('timeline-rail-menu-7'));
    expect(screen.queryByTestId('timeline-rail-menu-map-7')).toBeNull();
    expect(screen.queryByTestId('timeline-rail-move-up-7')).toBeNull();
    expect(screen.getByTestId('timeline-rail-move-down-7')).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-menu-sort-7')).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-delete-7')).toBeTruthy();
  });
  it('有地點 → 有「在地圖開啟」；末列且非第一列（index>0）→ 有上移沒有下移', () => {
    renderRow({ ...base, locations: ['沖繩縣那霸市'] } as TimelineEntryData, { index: 2, isLast: true, onMoveStep: () => {} });
    fireEvent.click(screen.getByTestId('timeline-rail-menu-7'));
    expect(screen.getByTestId('timeline-rail-menu-map-7')).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-move-up-7')).toBeTruthy();
    expect(screen.queryByTestId('timeline-rail-move-down-7')).toBeNull();
  });
});
