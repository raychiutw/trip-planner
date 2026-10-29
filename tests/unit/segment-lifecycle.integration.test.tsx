import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import TimelineRail from '../../src/components/trip/TimelineRail';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';
import { TripIdContext } from '../../src/contexts/TripIdContext';
import { TripDaysContext } from '../../src/contexts/TripDaysContext';
import { EVENT } from '../../src/lib/events';
import { __resetTravelRecomputeState } from '../../src/lib/travelRecompute';
import { getToasts, resetToasts } from '../../src/lib/toastBus';

const apiFetchMock = vi.fn<(path: string) => Promise<unknown>>();
const apiFetchRawMock = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string) => apiFetchMock(path),
  apiFetchRaw: (path: string, init?: RequestInit) => apiFetchRawMock(path, init),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function entry(id: number): TimelineEntryData {
  return { id, time: '09:00-10:00', title: `景點 ${id}`, description: null, note: null,
    googleRating: null, masterLat: 26 + id * 0.01, masterLng: 127 + id * 0.01 };
}

function railView(events = [entry(1), entry(2)], tripId: string | null = 't1', dayId = 55) {
  return <MemoryRouter>
    <TripIdContext.Provider value={tripId}>
      <TripDaysContext.Provider value={[{ dayId: 55, dayNum: 3, label: 'Day 3', stopCount: 2 }]}>
        <TimelineRail events={events} dayId={dayId} />
      </TripDaysContext.Provider>
    </TripIdContext.Provider>
  </MemoryRouter>;
}

function renderRail(events = [entry(1), entry(2)], tripId: string | null = 't1', dayId = 55) {
  return render(railView(events, tripId, dayId));
}

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchRawMock.mockReset();
  apiFetchRawMock.mockResolvedValue(new Response(JSON.stringify({ pairsComputed: 1 }), { status: 200 }));
  __resetTravelRecomputeState();
  resetToasts();
});

it('更新事件遇到未完成的舊讀取，畫面等新讀取確認缺口後才自動補算', async () => {
  const first = deferred<unknown>();
  const fresh = deferred<unknown>();
  apiFetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(fresh.promise);
  renderRail();
  await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
  act(() => window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: { tripId: 't1', dayNum: 3 } })));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 250)); });
  expect(apiFetchRawMock).not.toHaveBeenCalled();

  await act(async () => { first.resolve([]); await first.promise; });
  await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));
  expect(apiFetchRawMock).not.toHaveBeenCalled();

  await act(async () => { fresh.resolve([]); await fresh.promise; });
  await waitFor(() => expect(apiFetchRawMock).toHaveBeenCalledTimes(1));
  expect(apiFetchRawMock.mock.calls[0]![0]).toBe('/trips/t1/recompute-travel?day=3');
});

it('首次讀取未完成或失敗不把空 map 當缺口；成功重讀後才補算', async () => {
  const first = deferred<unknown>();
  apiFetchMock.mockReturnValueOnce(first.promise).mockResolvedValueOnce([]);
  renderRail();
  await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
  expect(apiFetchRawMock).not.toHaveBeenCalled();
  expect(screen.queryByTestId('travel-pill-stale')).toBeNull();

  await act(async () => { first.reject(new Error('offline')); await first.promise.catch(() => {}); });
  expect(apiFetchRawMock).not.toHaveBeenCalled();
  expect(screen.queryByTestId('travel-pill-stale')).toBeNull();

  act(() => window.dispatchEvent(new CustomEvent(EVENT.segmentUpdated, { detail: { tripId: 't1' } })));
  await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(apiFetchRawMock).toHaveBeenCalledTimes(1));
});

it('相同缺口重讀不重複 POST；403 後畫面呈現待更新並停止自動補算', async () => {
  apiFetchMock.mockResolvedValue([]);
  apiFetchRawMock.mockResolvedValue(new Response('{}', { status: 403 }));
  renderRail();
  await waitFor(() => expect(apiFetchRawMock).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByTestId('travel-pill-stale').textContent).toContain('待更新'));

  act(() => window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: { tripId: 't1', dayNum: 3 } })));
  await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));
  expect(apiFetchRawMock).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('travel-pill-stale').textContent).toContain('待更新');
});

it('缺座標 pair 不自動補算，未知日期不擴張成全行程 POST', async () => {
  apiFetchMock.mockResolvedValue([]);
  const withoutCoords = { ...entry(1), masterLat: null, masterLng: null };
  const first = renderRail([withoutCoords, entry(2)]);
  await waitFor(() => expect(screen.getByTestId('travel-pill-stale').textContent).toContain('缺座標'));
  expect(apiFetchRawMock).not.toHaveBeenCalled();
  first.unmount();

  renderRail([entry(1), entry(2)], 't2', 999);
  await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));
  expect(apiFetchRawMock).not.toHaveBeenCalled();
});

it('已算好的 segment 不補算；computedAt 為空才補算指定日期', async () => {
  const segment = { id: 9, tripId: 't1', fromEntryId: 1, toEntryId: 2, mode: 'driving',
    submode: null, min: 5, distanceM: 500, source: 'google', updatedAt: 1, noTravel: null };
  apiFetchMock.mockResolvedValueOnce([{ ...segment, computedAt: 1 }]).mockResolvedValueOnce([{ ...segment, computedAt: null }]);
  renderRail();
  await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
  expect(apiFetchRawMock).not.toHaveBeenCalled();
  act(() => window.dispatchEvent(new CustomEvent(EVENT.segmentUpdated, { detail: { tripId: 't1' } })));
  await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(apiFetchRawMock).toHaveBeenCalledTimes(1));
  expect(apiFetchRawMock.mock.calls[0]![0]).toBe('/trips/t1/recompute-travel?day=3');
});

it('暫時排序在 batch PATCH 提交前不把 optimistic adjacency 當缺口補算', async () => {
  const segments = [
    { id: 9, tripId: 't1', fromEntryId: 1, toEntryId: 2, mode: 'driving', computedAt: 1 },
    { id: 10, tripId: 't1', fromEntryId: 2, toEntryId: 3, mode: 'driving', computedAt: 1 },
  ];
  apiFetchMock.mockResolvedValue(segments);
  const save = deferred<Response>();
  apiFetchRawMock.mockReturnValueOnce(save.promise);
  renderRail([entry(1), entry(2), entry(3)]);
  await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByTestId('timeline-rail-move-down-1'));
  await waitFor(() => expect(apiFetchRawMock).toHaveBeenCalledTimes(1));
  expect(apiFetchRawMock.mock.calls[0]![0]).toContain('/entries/batch');
  await act(async () => { save.resolve(new Response('{}', { status: 200 })); await save.promise; });
});

it('切換行程時不顯示舊排序，也不讓舊儲存的車程失敗提示干擾新行程', async () => {
  const save = deferred<Response>();
  apiFetchMock.mockResolvedValue([]);
  apiFetchRawMock.mockImplementation((path) => path.includes('/entries/batch')
    ? save.promise : Promise.resolve(new Response('{}', { status: 500 })));
  const page = renderRail([entry(1), entry(2), entry(3)]);
  fireEvent.click(screen.getByTestId('timeline-rail-move-down-1'));
  await waitFor(() => expect(apiFetchRawMock).toHaveBeenCalledTimes(1));
  expect(screen.getAllByTestId(/timeline-rail-row-\d+/).map((row) => row.getAttribute('data-testid')))
    .toEqual(['timeline-rail-row-2', 'timeline-rail-row-1', 'timeline-rail-row-3']);

  page.rerender(railView([entry(1), entry(2), entry(3)], 't2'));
  expect(screen.getAllByTestId(/timeline-rail-row-\d+/).map((row) => row.getAttribute('data-testid')))
    .toEqual(['timeline-rail-row-1', 'timeline-rail-row-2', 'timeline-rail-row-3']);
  page.rerender(railView([entry(1), entry(2), entry(3)], 't1'));
  expect(screen.getAllByTestId(/timeline-rail-row-\d+/).map((row) => row.getAttribute('data-testid')))
    .toEqual(['timeline-rail-row-1', 'timeline-rail-row-2', 'timeline-rail-row-3']);
  await act(async () => { save.resolve(new Response('{}', { status: 200 })); await save.promise; });
  await waitFor(() => expect(apiFetchRawMock.mock.calls.some(([path]) => path.includes('/recompute-travel'))).toBe(true));
  expect(getToasts()).toEqual([]);
});

it('排序已儲存但車程失敗時保留新位置並提示交通待更新', async () => {
  apiFetchMock.mockResolvedValue([]);
  apiFetchRawMock.mockImplementation(async (path) => new Response('{}', {
    status: path.includes('/recompute-travel') ? 500 : 200,
  }));
  renderRail([entry(1), entry(2), entry(3)]);
  fireEvent.click(screen.getByTestId('timeline-rail-move-down-1'));
  await waitFor(() => expect(getToasts().some((toast) => toast.message.includes('順序已儲存，但車程時間更新失敗'))).toBe(true));
  expect(screen.getAllByTestId(/timeline-rail-row-\d+/).map((row) => row.getAttribute('data-testid')))
    .toEqual(['timeline-rail-row-2', 'timeline-rail-row-1', 'timeline-rail-row-3']);
  expect(apiFetchRawMock.mock.calls.filter(([path]) => path.includes('/entries/batch'))).toHaveLength(1);
});

it('A→B→A 切換時晚到的舊讀取不替目前行程確認缺口', async () => {
  const oldA = deferred<unknown>();
  const oldB = deferred<unknown>();
  const currentA = deferred<unknown>();
  apiFetchMock.mockReturnValueOnce(oldA.promise).mockReturnValueOnce(oldB.promise).mockReturnValueOnce(currentA.promise);
  const page = renderRail();
  await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
  page.rerender(railView([entry(1), entry(2)], 't2'));
  await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));
  page.rerender(railView([entry(1), entry(2)], 't1'));
  await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(3));

  await act(async () => { oldA.resolve([]); oldB.resolve([]); await Promise.all([oldA.promise, oldB.promise]); });
  expect(apiFetchRawMock).not.toHaveBeenCalled();
  await act(async () => { currentA.resolve([]); await currentA.promise; });
  await waitFor(() => expect(apiFetchRawMock).toHaveBeenCalledTimes(1));
  expect(apiFetchRawMock.mock.calls[0]![0]).toBe('/trips/t1/recompute-travel?day=3');
});

it('單筆 entry 與無 trip 狀態不發自動補算', async () => {
  apiFetchMock.mockResolvedValue([]);
  const first = renderRail([entry(1)]);
  await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
  expect(apiFetchRawMock).not.toHaveBeenCalled();
  first.unmount();

  renderRail([entry(1), entry(2)], null);
  expect(apiFetchMock).toHaveBeenCalledTimes(1);
  expect(apiFetchRawMock).not.toHaveBeenCalled();
});

it('混合缺口只補有座標的 pair；補齊座標形成新缺口後才再次補算', async () => {
  apiFetchMock.mockResolvedValue([]);
  const noCoords = { ...entry(3), masterLat: null, masterLng: null };
  const page = renderRail([entry(1), entry(2), noCoords]);
  await waitFor(() => expect(apiFetchRawMock).toHaveBeenCalledTimes(1));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 250)); });
  expect(apiFetchRawMock).toHaveBeenCalledTimes(1);

  page.rerender(railView([entry(1), entry(2), entry(3)]));
  await waitFor(() => expect(apiFetchRawMock).toHaveBeenCalledTimes(2));
  expect(apiFetchRawMock.mock.calls[1]![0]).toBe('/trips/t1/recompute-travel?day=3');
});

it('時間儲存成功但車程重算失敗時保留 entry，只提示待更新且不重送 PATCH', async () => {
  const segment = { id: 9, tripId: 't1', fromEntryId: 1, toEntryId: 2, mode: 'driving' };
  apiFetchMock.mockResolvedValueOnce([{ ...segment, computedAt: 1 }])
    .mockResolvedValue([{ ...segment, computedAt: null }]);
  apiFetchRawMock.mockImplementation(async (path: string) =>
    path.includes('/recompute-travel')
      ? new Response('{}', { status: 500 })
      : new Response('{}', { status: 200 }));
  renderRail([{ ...entry(1), startTime: '09:00', endTime: '10:00' }, entry(2)]);
  await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByTestId('timeline-rail-time-chip-1'));
  fireEvent.click(screen.getByLabelText('抵達時間'));
  fireEvent.click(document.querySelector('.tp-time-popover [data-h="08"]')!);
  fireEvent.click(screen.getByText('完成'));

  await waitFor(() => expect(getToasts().some((t) => t.message.includes('時間已儲存，車程更新失敗'))).toBe(true));
  await waitFor(() => expect(screen.getByTestId('travel-pill-stale').textContent).toContain('待更新'));
  expect(screen.getByTestId('timeline-rail-row-1')).toBeTruthy();
  expect(apiFetchRawMock.mock.calls.filter(([path]) => path.includes('/entries/1'))).toHaveLength(1);
});
