/**
 * TimelineRail — 就地改起訖時間（V2 header chip → 共用 TripTimePicker popup）+ 備選一鍵升正選。
 *
 * 鎖：
 *   - header sub-line 的時間 chip（收合狀態即可見）顯示起訖，點擊開 popup（抵達/離開 picker + 完成）。
 *   - 無時間 entry → chip 顯示「設定時間」。
 *   - 展開後備選卡含「設為正選」鈕 → 點擊 PATCH /entries/:eid/master { poiId }。
 * 深層 picker 選值 → PATCH 由瀏覽器 QA 驗（headlessui popover scroll list 在 jsdom 脆）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimelineRail from '../../src/components/trip/TimelineRail';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';
import { TripIdContext } from '../../src/contexts/TripIdContext';

vi.mock('../../src/hooks/useTripSegments', () => ({
  useTripSegments: () => ({ segments: [], segmentMap: new Map(), loading: false }),
}));

const apiFetchRawMock = vi.fn(
  async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
);
vi.mock('../../src/lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/apiClient')>('../../src/lib/apiClient');
  return { ...actual, apiFetchRaw: (...args: unknown[]) => apiFetchRawMock(...args) };
});
vi.mock('../../src/lib/travelRecompute', () => ({
  requestTravelRecompute: vi.fn(() => Promise.resolve()),
  getAutoRecomputeStatus: () => 'active',
}));
vi.mock('../../src/components/shared/Toast', () => ({ showToast: vi.fn() }));

const ENTRY: TimelineEntryData = {
  id: 42,
  startTime: '13:00',
  endTime: '14:00',
  title: '糸滿魚市場',
  stopPois: [
    { poiId: 9001, sortOrder: 1, name: '糸滿魚市場' },
    { poiId: 9002, sortOrder: 2, name: '泊港漁市場', type: 'shopping' },
  ],
};

const ENTRY_NO_TIME: TimelineEntryData = {
  id: 43,
  title: '無時間景點',
  stopPois: [{ poiId: 8001, sortOrder: 1, name: '無時間景點' }],
};

function renderRail(events: TimelineEntryData[] = [ENTRY]) {
  return render(
    <MemoryRouter>
      <TripIdContext.Provider value="okinawa-2026">
        <TimelineRail events={events} />
      </TripIdContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiFetchRawMock.mockClear();
});

describe('TimelineRail — inline 改時間 + 備選升正選', () => {
  it('時間 chip 於收合狀態即可見、顯示起訖', () => {
    renderRail();
    // 未展開 detail
    expect(screen.queryByTestId('timeline-rail-detail-42')).toBeNull();
    const chip = screen.getByTestId('timeline-rail-time-chip-42');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('13:00');
    expect(chip.textContent).toContain('14:00');
  });

  it('點時間 chip → 開 popup 含 抵達 / 離開 picker + 完成', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-time-chip-42'));
    // popup portal 到 body — 用 role/aria-label 找
    const dialog = screen.getByRole('dialog', { name: '起訖時間' });
    expect(dialog).toBeTruthy();
    // a11y：dialog 標記 aria-modal（SR 宣告為模態）
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByLabelText('抵達時間')).toBeTruthy();
    expect(screen.getByLabelText('離開時間')).toBeTruthy();
    expect(screen.getByText('完成')).toBeTruthy();
  });

  it('Escape 關閉 popup；無 draft 變動 → 不打 API（save-on-close no-op）', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-time-chip-42'));
    const dialog = screen.getByRole('dialog', { name: '起訖時間' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '起訖時間' })).toBeNull();
    expect(apiFetchRawMock).not.toHaveBeenCalled();
  });

  it('無 start/end 的 entry → chip 顯示「設定時間」', () => {
    renderRail([ENTRY_NO_TIME]);
    const chip = screen.getByTestId('timeline-rail-time-chip-43');
    expect(chip.textContent).toContain('設定時間');
  });

  it('展開後備選卡含「設為正選」鈕 → 點擊 PATCH /entries/:eid/master { poiId }', async () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    const btn = screen.getByTestId('timeline-rail-set-master-42-9002');
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    await waitFor(() => expect(apiFetchRawMock).toHaveBeenCalled());
    const [url, opts] = apiFetchRawMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/trips/okinawa-2026/entries/42/master');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body as string)).toEqual({ poiId: 9002 });
  });

  it('正選（sortOrder=1）不出現在備選、無 set-master 鈕', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    // 9001 是 master → 不該有它的 set-master 鈕
    expect(screen.queryByTestId('timeline-rail-set-master-42-9001')).toBeNull();
  });
});
