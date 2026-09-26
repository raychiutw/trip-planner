import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import TripPage from '../../src/pages/TripPage';
import EntryActionPage from '../../src/pages/EntryActionPage';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';
import { SheetStackProvider } from '../../src/contexts/SheetStackContext';
import { __resetTravelRecomputeState } from '../../src/lib/travelRecompute';
import { resetToasts } from '../../src/lib/toastBus';
import { __clearMyTripsCache } from '../../src/hooks/useMyTrips';

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
    if (tail === 'segments') return response(tripDays.flatMap((d) => d.timeline.slice(1).map((e, i) => ({
      id: e.id, tripId, fromEntryId: d.timeline[i]!.id, toEntryId: e.id, mode: 'driving', min: 10, distanceM: 2000,
      computedAt: recomputeStatus === 200 ? 1 : null,
    }))));
    if (tail === 'recompute-travel') { recomputes.push(`${tripId}:${url.searchParams.get('day')}`); return response({}, recomputeStatus); }
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
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

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
    fireEvent.click(screen.getByText('移動甲景點'));
    fireEvent.click(await screen.findByTestId('entry-action-day-3'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await waitFor(() => expect(within(day(3)).getByText('甲景點1')).toBeInTheDocument());
    await waitFor(() => expect(within(day(3)).queryByTestId('travel-pill-stale')).not.toBeInTheDocument());
    expect(writes).toHaveLength(2);
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
