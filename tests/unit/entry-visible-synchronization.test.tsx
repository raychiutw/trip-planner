import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import TripPage from '../../src/pages/TripPage';
import EntryActionPage from '../../src/pages/EntryActionPage';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';
import { __clearMyTripsCache } from '../../src/hooks/useMyTrips';
import { SheetStackProvider } from '../../src/contexts/SheetStackContext';
import { __resetTravelRecomputeState } from '../../src/lib/travelRecompute';
import { moveEntry } from '../../src/lib/entryMutations';
import { resetToasts } from '../../src/lib/toastBus';

function entry(id: number, name: string, dayId: number) {
  const master = { poiId: id + 1000, name, type: 'attraction', lat: 26 + id / 1000, lng: 127, note: null };
  return { id, dayId, startTime: '09:00', endTime: '10:00', sortOrder: 0, master, stopPois: [master], alternates: [], entryPoisVersion: '1' };
}
function days(tripId: string) {
  const offset = tripId === 't1' ? 0 : 100;
  return [1, 2, 3].map((n) => ({ id: offset + n, dayNum: n, date: `2026-09-2${n}`, dayOfWeek: '一', label: `第${n}天`,
    timeline: [entry(offset + n * 10 + 1, `${tripId === 't1' ? '甲' : '乙'}景點${n}`, offset + n)],
  }));
}
let data: Record<string, ReturnType<typeof days>>;
let writes: string[];
let recomputes: string[];
let dayReads: string[];
let segmentReads: string[];
let beforeSegments: ((tripId: string, snapshot: unknown) => Promise<Response> | undefined) | undefined;
let beforeRecompute: ((tripId: string, dayNum: string | null) => Promise<Response> | undefined) | undefined;
let manualSegment: Record<string, unknown>;
let segmentWrites: Record<string, unknown>[];
let beforeRead: ((tripId: string, dayNum: number, snapshot: unknown) => Promise<Response> | undefined) | undefined;
let beforeWrite: (() => Promise<void>) | undefined;
let writeStatus = 200;
let recomputeStatus = 200;
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  localStorage.clear();
  __clearMyTripsCache();
  __resetTravelRecomputeState();
  resetToasts();
  data = { t1: days('t1'), t2: days('t2') };
  writes = []; recomputes = []; dayReads = []; beforeRead = undefined; beforeWrite = undefined; writeStatus = 200; recomputeStatus = 200;
  segmentReads = []; beforeSegments = undefined; beforeRecompute = undefined;
  manualSegment = {}; segmentWrites = [];
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn();
  window.scrollTo = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'https://test');
    const path = url.pathname;
    if (path === '/api/oauth/userinfo') return response({ id: 'owner', email: 'owner@test.com', displayName: 'Owner' });
    if (path === '/api/my-trips') return response([{ tripId: 't1', name: '甲行程' }, { tripId: 't2', name: '乙行程' }]);
    const match = path.match(/^\/api\/trips\/(t[12])(?:\/(.*))?$/);
    if (!match) return response([]);
    const tripId = match[1]!;
    const tail = match[2] ?? '';
    const tripDays = data[tripId]!;
    if (!tail) return response({ id: tripId, name: `${tripId}行程`, published: 1, countries: 'JP' });
    if (tail === 'days') return response(tripDays);
    if (tail.startsWith('days/')) {
      const n = Number(tail.split('/')[1]);
      dayReads.push(`${tripId}:${n}`);
      const snapshot = structuredClone(tripDays.find((d) => d.dayNum === n));
      return beforeRead?.(tripId, n, snapshot) ?? response(snapshot);
    }
    if (tail === 'segments') {
      segmentReads.push(tripId);
      const snapshot = tripDays.flatMap((d) => d.timeline.slice(1).map((e, i) => ({
      id: e.id, tripId, fromEntryId: d.timeline[i]!.id, toEntryId: e.id, mode: 'driving', min: 10, distanceM: 2000,
      computedAt: recomputeStatus === 200 ? 1 : null,
      ...manualSegment,
      })));
      return beforeSegments?.(tripId, snapshot) ?? response(snapshot);
    }
    if (tail.startsWith('segments/') && init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body));
      segmentWrites.push(body);
      manualSegment = { ...body, source: 'manual', computedAt: 1, version: 2 };
      return response(manualSegment);
    }
    if (tail === 'recompute-travel') { recomputes.push(`${tripId}:${url.searchParams.get('day')}`); return beforeRecompute?.(tripId, url.searchParams.get('day')) ?? response({}, recomputeStatus); }
    if (tail.startsWith('entries/')) {
      const id = Number(tail.split('/')[1]);
      const from = tripDays.find((d) => d.timeline.some((e) => e.id === id));
      const original = from?.timeline.find((e) => e.id === id);
      if (!init?.method || init.method === 'GET') return response(original);
      writes.push(`${tripId}:${tail}`);
      await beforeWrite?.();
      if (writeStatus !== 200) return response({ error: { message: '沒有編輯權限' } }, writeStatus);
      const body = JSON.parse(String(init.body));
      if (tail === 'entries/batch') {
        for (const update of body.updates) {
          const source = tripDays.find((d) => d.timeline.some((e) => e.id === update.id));
          const moved = source!.timeline.find((e) => e.id === update.id)!;
          if (update.day_id) { source!.timeline = source!.timeline.filter((e) => e !== moved); tripDays.find((d) => d.id === update.day_id)!.timeline.push(moved); moved.dayId = update.day_id; }
          moved.sortOrder = update.sort_order;
        }
        for (const d of tripDays) d.timeline.sort((a, b) => a.sortOrder - b.sortOrder);
        return response({ ok: true });
      }
      const target = tripDays.find((d) => d.id === (body.day_id ?? body.targetDayId))!;
      const moved = structuredClone(original!);
      if (tail.endsWith('/copy')) moved.id = 99;
      else from!.timeline = from!.timeline.filter((e) => e.id !== id);
      moved.dayId = target.id;
      target.timeline.push(moved);
      return response(moved);
    }
    return response([]);
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function Workspace() {
  const { tripId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const current = tripId ?? new URLSearchParams(location.search).get('selected') ?? 't1';
  return <>
    <Link to="/trip/t2/stop/111/move">切換乙行程</Link>
    <Link to="/trip/t1/stop/11/move">移動甲景點</Link>
    <output data-testid="location">{location.pathname}{location.search}</output>
    <TripPage tripId={current} noShell />
    <SheetStackProvider value={{ inStack: true, closeStack: () => navigate(`/trips?selected=${current}`) }}>
      <Routes>
        <Route path="stop/:entryId/move" element={<EntryActionPage action="move" />} />
        <Route path="stop/:entryId/copy" element={<EntryActionPage action="copy" />} />
      </Routes>
    </SheetStackProvider>
  </>;
}
function open(action = 'move') {
  return render(<MemoryRouter initialEntries={[`/trip/t1/stop/11/${action}`]}><ActiveTripProvider><Routes>
    <Route path="/trip/:tripId/*" element={<Workspace />} />
    <Route path="/trips/*" element={<Workspace />} />
  </Routes></ActiveTripProvider></MemoryRouter>);
}
function day(n: number) { return document.querySelector<HTMLElement>(`section[data-day="${n}"]`)!; }

async function dragToDayTwo() {
  // The real detail now waits for the shared summary lifecycle. Give dnd-kit's
  // effect-installed sensor one task after the timeline first becomes visible.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  // jsdom 沒有排版引擎；只提供 sensor 讀取的外部幾何資訊，沿用真正的 DndContext。
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    const n = Number(this.closest('section[data-day]')?.getAttribute('data-day') ?? 0);
    return { x: 0, y: n * 200, left: 0, top: n * 200, right: 300, bottom: n * 200 + 80,
      width: 300, height: 80, toJSON: () => ({}) };
  });
  fireEvent.click(screen.getByTestId('timeline-rail-menu-11'));
  fireEvent.click(screen.getByTestId('timeline-rail-menu-sort-11'));
  const grip = screen.getByTestId('timeline-rail-grip-11');
  fireEvent.mouseDown(grip, { button: 0, clientX: 280, clientY: 220 });
  fireEvent.mouseMove(document, { clientX: 280, clientY: 240 });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  fireEvent.mouseMove(document, { clientX: 280, clientY: 420 });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  fireEvent.mouseUp(document, { clientX: 280, clientY: 420 });
  // dnd-kit 在 mouseup 後短暫攔截 click，避免 drop 被解讀成展開。
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 60)); });
}

describe('entry 變更的可見資料協調', () => {
  it('segment 讀取尚未完成時的移動刷新不遺失，也不重複補算已完成的缺口', async () => {
    let release!: () => void;
    beforeSegments = (_tripId, snapshot) => new Promise<Response>((resolve) => {
      beforeSegments = undefined;
      release = () => resolve(response(snapshot));
    });
    open();
    await screen.findByText('甲景點1');
    fireEvent.click(await screen.findByTestId('entry-action-day-2'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await waitFor(() => expect(within(day(2)).getByText('甲景點1')).toBeInTheDocument());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 250)); });
    expect([...recomputes].sort()).toEqual(['t1:1', 't1:2']);
    await act(async () => { release(); });
    await within(day(2)).findByText('10 min');
    expect([...recomputes].sort()).toEqual(['t1:1', 't1:2']);
    expect(segmentReads).toEqual(['t1', 't1']);
  });

  it('讀取未完成或失敗都不補算，成功確認空資料才依日期補算', async () => {
    data.t1![0]!.timeline.push(entry(12, '甲景點補站', 1));
    let release!: () => void;
    beforeSegments = () => new Promise<Response>((resolve) => { release = () => resolve(response({}, 500)); });
    const view = open();
    await screen.findByText('甲景點補站');
    expect(recomputes).toEqual([]);
    expect(screen.queryByTestId('travel-pill-stale')).not.toBeInTheDocument();
    await act(async () => { release(); });
    expect(recomputes).toEqual([]);
    expect(screen.queryByTestId('travel-pill-stale')).not.toBeInTheDocument();
    view.unmount();
    beforeSegments = () => Promise.resolve(response([]));
    open();
    await screen.findByText('甲景點補站');
    await waitFor(() => expect(recomputes).toEqual(['t1:1']));
    expect(screen.getByTestId('travel-pill-stale')).toHaveTextContent('重新計算中');
  });

  it('切換到讀取中的行程，不用上一趟已確認的空資料補算', async () => {
    data.t1![0]!.timeline.push(entry(12, '甲景點補站', 1));
    data.t2![0]!.timeline.push(entry(112, '乙景點補站', 101));
    recomputeStatus = 403;
    let release!: () => void;
    beforeSegments = (tripId) => tripId === 't1' ? Promise.resolve(response([]))
      : new Promise<Response>((resolve) => { release = () => resolve(response([])); });
    open();
    await screen.findByText('車程待更新');
    fireEvent.click(screen.getByText('切換乙行程'));
    await screen.findByText('乙景點補站');
    expect(recomputes).toEqual(['t1:1']);
    expect(screen.queryByTestId('travel-pill-stale')).not.toBeInTheDocument();
    await act(async () => { release(); });
    await waitFor(() => expect(recomputes).toEqual(['t1:1', 't2:1']));
  });

  it('A→B→A 之後舊的 entry 儲存完成，仍重算來源與目標，但不刷新目前頁面或提示導頁', async () => {
    open();
    await screen.findByText('甲景點1');
    let release!: () => void;
    beforeWrite = () => new Promise<void>((resolve) => { release = resolve; });
    fireEvent.click(await screen.findByTestId('entry-action-day-2'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await waitFor(() => expect(writes).toHaveLength(1));
    fireEvent.click(screen.getByText('切換乙行程'));
    await screen.findByText('乙景點1');
    fireEvent.click(screen.getByText('移動甲景點'));
    await screen.findByText('甲景點1');
    const readsBeforeCompletion = [...segmentReads];
    await act(async () => { release(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 250)); });
    expect([...recomputes].sort()).toEqual(['t1:1', 't1:2']);
    expect(dayReads).toEqual([]);
    expect(segmentReads).toEqual(readsBeforeCompletion);
    expect(screen.getByTestId('location')).toHaveTextContent('/trip/t1/stop/11/move');
    expect(screen.queryByText('景點已移動')).not.toBeInTheDocument();
    expect(within(day(1)).getByText('甲景點1')).toBeInTheDocument();
  });

  it('A→B→A 之後舊補算完成，不向目前行程發出刷新通知', async () => {
    data.t1![0]!.timeline.push(entry(12, '甲景點補站', 1));
    beforeSegments = () => Promise.resolve(response([]));
    let release!: () => void;
    beforeRecompute = () => new Promise<Response>((resolve) => { release = () => resolve(response({})); });
    open();
    await waitFor(() => expect(recomputes).toEqual(['t1:1']));
    beforeSegments = undefined;
    fireEvent.click(screen.getByText('切換乙行程'));
    await screen.findByText('乙景點1');
    fireEvent.click(screen.getByText('移動甲景點'));
    await screen.findByText('10 min');
    const readsBeforeCompletion = [...segmentReads];
    await act(async () => { release(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 250)); });
    expect(segmentReads).toEqual(readsBeforeCompletion);
    expect(screen.getByText('10 min')).toBeInTheDocument();
  });

  it('返回 A 的目前缺口加入既有補算，single-flight 完成仍刷新目前畫面', async () => {
    data.t1![0]!.timeline.push(entry(12, '甲景點補站', 1));
    beforeSegments = () => Promise.resolve(response([]));
    let release!: () => void;
    beforeRecompute = () => new Promise<Response>((resolve) => { release = () => resolve(response({})); });
    open();
    await waitFor(() => expect(recomputes).toEqual(['t1:1']));
    fireEvent.click(screen.getByText('切換乙行程'));
    await screen.findByText('乙景點1');
    fireEvent.click(screen.getByText('移動甲景點'));
    await screen.findByText('甲景點補站');
    await screen.findByTestId('travel-pill-stale');
    beforeSegments = undefined;
    await act(async () => { release(); });
    await screen.findByText('10 min');
    expect(recomputes).toEqual(['t1:1']);
  });

  it('返回 A 加入尚在執行的全行程補算，失敗時目前 day 顯示待更新', async () => {
    data.t1![0]!.timeline.push(entry(12, '甲景點補站', 1), entry(13, '甲景點第三站', 1));
    // Other mutation callers still use the supported whole-trip recompute scope.
    // The copy/move page now requires verified source metadata before enabling a write.
    const completions: (() => void)[] = [];
    open();
    await screen.findAllByText('10 min');
    beforeSegments = () => Promise.resolve(response([]));
    beforeRecompute = () => new Promise<Response>((resolve) => { completions.push(() => resolve(response({}, 500))); });
    await act(async () => { await moveEntry('t1', 11, { fromDayNum: null, toDayNum: 2, toDayId: 2 }); });
    await waitFor(() => expect(segmentReads.length).toBeGreaterThan(1));
    await within(day(1)).findByTestId('travel-pill-stale');
    fireEvent.click(screen.getByText('切換乙行程'));
    await screen.findByText('乙景點1');
    fireEvent.click(screen.getByText('移動甲景點'));
    await screen.findByText('甲景點補站');
    await within(day(1)).findByTestId('travel-pill-stale');
    await act(async () => { for (const finish of completions) finish(); });
    expect([...recomputes].sort()).toEqual(['t1:2', 't1:null']);
    expect(within(day(1)).getByTestId('travel-pill-stale')).toHaveTextContent('車程待更新');
  });

  it.each([403, 500])('離開 A 後補算才回 %s，返回時仍保留停止或失敗狀態', async (status) => {
    data.t1![0]!.timeline.push(entry(12, '甲景點補站', 1));
    beforeSegments = () => Promise.resolve(response([]));
    let release!: () => void;
    beforeRecompute = () => new Promise<Response>((resolve) => { release = () => resolve(response({}, status)); });
    open();
    await waitFor(() => expect(recomputes).toEqual(['t1:1']));
    fireEvent.click(screen.getByText('切換乙行程'));
    await screen.findByText('乙景點1');
    await act(async () => { release(); });
    expect(screen.queryByTestId('travel-pill-stale')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('移動甲景點'));
    await screen.findByText('甲景點補站');
    expect(screen.getByTestId('travel-pill-stale')).toHaveTextContent('車程待更新');
    expect(recomputes).toEqual(['t1:1']);
    beforeRecompute = undefined;
    recomputeStatus = status;
    fireEvent.click(screen.getByTestId('timeline-rail-menu-11'));
    fireEvent.click(screen.getByTestId('timeline-rail-move-down-11'));
    await waitFor(() => expect(segmentReads.length).toBeGreaterThan(3));
    expect(recomputes).toEqual(status === 403 ? ['t1:1', 't1:1'] : ['t1:1', 't1:1', 't1:1']);
  });

  it('已有成功快照後刷新失敗，不用舊空資料追加補算，已儲存景點仍顯示車程待更新', async () => {
    open();
    await screen.findByText('甲景點1');
    await waitFor(() => expect(segmentReads).toEqual(['t1']));
    beforeSegments = () => Promise.resolve(response({}, 500));
    recomputeStatus = 500;
    fireEvent.click(await screen.findByTestId('entry-action-day-2'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await waitFor(() => expect(within(day(2)).getByText('甲景點1')).toBeInTheDocument());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 250)); });
    expect([...recomputes].sort()).toEqual(['t1:1', 't1:2']);
    expect(writes).toEqual(['t1:entries/11']);
    expect(within(day(2)).getByText('車程待更新')).toBeInTheDocument();
  });

  it('重新排序後 A→B→A，舊重算失敗不在目前行程顯示操作提示', async () => {
    data.t1![0]!.timeline.push(entry(12, '甲景點補站', 1));
    open();
    await screen.findByText('10 min');
    let release!: () => void;
    beforeRecompute = () => new Promise<Response>((resolve) => { release = () => resolve(response({}, 500)); });
    fireEvent.click(screen.getByTestId('timeline-rail-menu-11'));
    fireEvent.click(screen.getByTestId('timeline-rail-move-down-11'));
    await waitFor(() => expect(recomputes).toEqual(['t1:1']));
    fireEvent.click(screen.getByText('切換乙行程'));
    await screen.findByText('乙景點1');
    fireEvent.click(screen.getByText('移動甲景點'));
    await screen.findByText('10 min');
    await act(async () => { release(); });
    expect(screen.queryByText('順序已儲存，但車程時間更新失敗，重新整理後再試')).not.toBeInTheDocument();
  });

  it('排序尚未提交時不補算 optimistic 相鄰景點，提交後只重算該日一次', async () => {
    data.t1![0]!.timeline.push(entry(12, '甲景點補站', 1));
    open();
    await screen.findByText('10 min');
    let release!: () => void;
    beforeWrite = () => new Promise<void>((resolve) => { release = resolve; });
    fireEvent.click(screen.getByTestId('timeline-rail-menu-11'));
    fireEvent.click(screen.getByTestId('timeline-rail-move-down-11'));
    await waitFor(() => expect(writes).toEqual(['t1:entries/batch']));
    expect(recomputes).toEqual([]);
    await act(async () => { release(); });
    await within(day(1)).findByText('10 min');
    expect(recomputes).toEqual(['t1:1']);
  });

  it.each(['缺座標', '未知 day'] as const)('%s 的 pair 不擴張成自動全行程補算', async (reason) => {
    data.t1![0]!.timeline.push(entry(12, '甲景點補站', 1));
    if (reason === '缺座標') Object.assign(data.t1![0]!.timeline[0]!.master, { lat: null });
    else Object.assign(data.t1![0]!, { id: null });
    beforeSegments = () => Promise.resolve(response([]));
    open();
    await screen.findByText('甲景點補站');
    expect(recomputes).toEqual([]);
    if (reason === '缺座標') expect(screen.getByTestId('travel-pill-stale')).toHaveTextContent('缺座標');
  });

  it.each([403, 500])('自動補算 %s 後相同缺口不重試，真正排序變更沿用唯讀停止或新 signature 重試規則', async (status) => {
    data.t1![0]!.timeline.push(entry(12, '甲景點補站', 1));
    beforeSegments = () => Promise.resolve(response([]));
    recomputeStatus = status;
    open();
    await screen.findByText('車程待更新');
    expect(recomputes).toEqual(['t1:1']);
    fireEvent.click(screen.getByText('移動甲景點'));
    expect(recomputes).toEqual(['t1:1']);
    fireEvent.click(screen.getByTestId('timeline-rail-menu-11'));
    fireEvent.click(screen.getByTestId('timeline-rail-move-down-11'));
    await waitFor(() => expect(segmentReads.length).toBeGreaterThan(1));
    await screen.findByText('車程待更新');
    expect(recomputes).toEqual(status === 403 ? ['t1:1', 't1:1'] : ['t1:1', 't1:1', 't1:1']);
    expect(writes).toEqual(['t1:entries/batch']);
  });

  it('A→B→A 的舊 segment 讀取晚到，不覆寫最新車程', async () => {
    data.t1![0]!.timeline.push(entry(12, '甲景點補站', 1));
    let release!: () => void;
    beforeSegments = (_tripId, snapshot) => new Promise<Response>((resolve) => {
      beforeSegments = undefined;
      release = () => resolve(response((snapshot as Record<string, unknown>[]).map((s) => ({ ...s, min: 99 }))));
    });
    open();
    await screen.findByText('甲景點補站');
    fireEvent.click(screen.getByText('切換乙行程'));
    await screen.findByText('乙景點1');
    fireEvent.click(screen.getByText('移動甲景點'));
    await screen.findByText('10 min');
    await act(async () => { release(); });
    expect(screen.getByText('10 min')).toBeInTheDocument();
    expect(screen.queryByText('99 min')).not.toBeInTheDocument();
  });

  it('交通對話框手填公車分鐘後，既有通知刷新真實行程車程', async () => {
    data.t1![0]!.timeline.push(entry(12, '甲景點補站', 1));
    open();
    await screen.findByText('10 min');
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(await screen.findByTestId('travel-method-bus'));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fireEvent.change(screen.getByTestId('travel-min-input'), { target: { value: '17' } });
    fireEvent.blur(screen.getByTestId('travel-min-input'));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(segmentWrites.at(-1)).toMatchObject({ mode: 'transit', submode: 'bus', min: 17 });
    expect(within(day(1)).getByText('17 min')).toBeInTheDocument();
    expect(recomputes).toEqual([]);
  });

  it('切換行程後拖曳儲存完成，不在新行程顯示舊操作的提示', async () => {
    open();
    await screen.findByText('甲景點1');
    let release!: () => void;
    beforeWrite = () => new Promise<void>((resolve) => { release = resolve; });
    await dragToDayTwo();
    await waitFor(() => expect(writes).toHaveLength(1));
    fireEvent.click(screen.getByText('切換乙行程'));
    await screen.findByText('乙景點1');
    await act(async () => { release(); });
    expect(screen.queryByText('已移到 Day 02')).not.toBeInTheDocument();
    expect(within(day(1)).getByText('乙景點1')).toBeInTheDocument();
  });

  it('拖曳跨日移動經真實動詞與讀取協調，同步兩天的畫面', async () => {
    open();
    await screen.findByText('甲景點1');
    await dragToDayTwo();
    await waitFor(() => expect(within(day(2)).getByText('甲景點1')).toBeInTheDocument());
    expect(within(day(1)).queryByText('甲景點1')).not.toBeInTheDocument();
    expect(writes).toEqual(['t1:entries/batch']);
    expect(new Set(recomputes)).toEqual(new Set(['t1:1', 't1:2']));
  });

  it('複製只新增目標日的副本並重算目標日', async () => {
    open('copy');
    await screen.findByText('甲景點1');
    fireEvent.click(await screen.findByTestId('entry-action-day-2'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await waitFor(() => expect(within(day(2)).getByText('甲景點1')).toBeInTheDocument());
    expect(within(day(1)).getByText('甲景點1')).toBeInTheDocument();
    expect(new Set(recomputes)).toEqual(new Set(['t1:2']));
    expect(dayReads).toEqual(['t1:2']);
    expect(writes).toEqual(['t1:entries/11/copy']);
  });

  it.each([403, 500])('寫入遭 %s 拒絕，保留原內容與操作面板且沒有成功提示', async (status) => {
    writeStatus = status;
    open();
    await screen.findByText('甲景點1');
    fireEvent.click(await screen.findByTestId('entry-action-day-2'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await screen.findByText('沒有編輯權限');
    expect(screen.getByTestId('location')).toHaveTextContent('/trip/t1/stop/11/move');
    expect(within(day(1)).getByText('甲景點1')).toBeInTheDocument();
    expect(within(day(2)).queryByText('甲景點1')).not.toBeInTheDocument();
    expect(screen.queryByText('景點已移動')).not.toBeInTheDocument();
    expect(recomputes).toEqual([]);
  });

  it('移動已儲存但重算故障時，景點維持可見，交通顯示待更新', async () => {
    recomputeStatus = 500;
    open();
    await screen.findByText('甲景點1');
    fireEvent.click(await screen.findByTestId('entry-action-day-2'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await waitFor(() => expect(within(day(2)).getByText('甲景點1')).toBeInTheDocument());
    expect(within(day(1)).queryByText('甲景點1')).not.toBeInTheDocument();
    await within(day(2)).findByText('車程待更新');
    expect(writes).toEqual(['t1:entries/11']);
    recomputeStatus = 200;
    fireEvent.click(await screen.findByRole('button', { name: '重試交通更新' }));
    await waitFor(() => expect(within(day(2)).queryByTestId('travel-pill-stale')).not.toBeInTheDocument());
    expect(within(day(2)).getByText('甲景點1')).toBeInTheDocument();
    expect(writes).toHaveLength(1);
  });

  it('連續移動時，較舊的 day 回應不能把已移走的景點加回來', async () => {
    open();
    await screen.findByText('甲景點1');
    let release: (() => void) | undefined;
    beforeRead = (tripId, n, snapshot) => tripId === 't1' && n === 2 && !release
      ? new Promise<Response>((resolve) => { release = () => resolve(response(snapshot)); }) : undefined;
    fireEvent.click(await screen.findByTestId('entry-action-day-2'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await waitFor(() => expect(release).toBeDefined());
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/trips?selected=t1'));
    fireEvent.click(screen.getByText('移動甲景點'));
    fireEvent.click(await screen.findByTestId('entry-action-day-3'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await waitFor(() => expect(within(day(3)).getByText('甲景點1')).toBeInTheDocument());
    await act(async () => { release!(); });
    expect(within(day(2)).queryByText('甲景點1')).not.toBeInTheDocument();
    expect(within(day(3)).getByText('甲景點1')).toBeInTheDocument();
    expect(writes).toHaveLength(2);
  });

  it('切換行程後舊操作完成，不顯示成功提示或導回舊行程', async () => {
    open();
    await screen.findByText('甲景點1');
    let release!: () => void;
    beforeWrite = () => new Promise<void>((resolve) => { release = resolve; });
    fireEvent.click(await screen.findByTestId('entry-action-day-2'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await waitFor(() => expect(writes).toHaveLength(1));
    fireEvent.click(screen.getByText('切換乙行程'));
    await screen.findByText('乙景點1');
    await act(async () => { release(); });
    expect(screen.getByTestId('location')).toHaveTextContent('/trip/t2/stop/111/move');
    expect(screen.queryByText('景點已移動')).not.toBeInTheDocument();
    expect(within(day(1)).getByText('乙景點1')).toBeInTheDocument();
    expect(dayReads.filter((r) => r.startsWith('t2:'))).toEqual([]);
  });

  it('移動後舊行程的 day 回應晚到，不污染新行程的畫面', async () => {
    open();
    await screen.findByText('甲景點1');
    let release: (() => void) | undefined;
    beforeRead = (tripId, dayNum, snapshot) => {
      if (tripId === 't1' && dayNum === 2 && !release) {
        return new Promise<Response>((resolve) => { release = () => resolve(response(snapshot)); });
      }
    };
    fireEvent.click(await screen.findByTestId('entry-action-day-2'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await waitFor(() => expect(release).toBeDefined());
    fireEvent.click(screen.getByText('切換乙行程'));
    await screen.findByText('乙景點1');
    await act(async () => { release!(); });
    expect(within(day(2)).getByText('乙景點2')).toBeInTheDocument();
    expect(screen.queryByText('甲景點1')).not.toBeInTheDocument();
  });

  it('操作面板跨日移動時，停留第三天也更新來源與目標', async () => {
    open();
    await screen.findByText('甲景點1');
    fireEvent.click(screen.getByTestId('dn-day-3'));
    fireEvent.click(await screen.findByTestId('entry-action-day-2'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await waitFor(() => expect(within(day(2)).getByText('甲景點1')).toBeInTheDocument());
    expect(within(day(1)).queryByText('甲景點1')).not.toBeInTheDocument();
    expect(within(day(3)).getByText('甲景點3')).toBeInTheDocument();
    expect(new Set(recomputes)).toEqual(new Set(['t1:1', 't1:2']));
  });
});
