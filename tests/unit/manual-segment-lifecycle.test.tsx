import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation, useParams, useNavigate, createMemoryRouter, RouterProvider } from 'react-router-dom';
import TripPage from '../../src/pages/TripPage';
import EditEntryPage from '../../src/pages/EditEntryPage';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';
import { SheetStackProvider } from '../../src/contexts/SheetStackContext';
import { __resetTravelRecomputeState } from '../../src/lib/travelRecompute';
import { resetToasts } from '../../src/lib/toastBus';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function entry(id: number, tripId: string) {
  const master = { poiId: id + 1000, name: `${tripId}景點${id}`, type: 'attraction', lat: 26, lng: 127, note: null };
  return { id, dayId: 1, startTime: '09:00', endTime: '10:00', description: '', sortOrder: id, master, stopPois: [master], alternates: [], entryPoisVersion: '1' };
}
function segment(tripId = 't1') {
  return { id: 7, tripId, fromEntryId: 11, toEntryId: 12, mode: 'driving', submode: null as string | null,
    min: 10 as number | null, distanceM: 2000, computedAt: 1 as number | null, source: 'google', version: 1, noTravel: null as number | null };
}
type Write = { tripId: string; method: string; body: Record<string, unknown>; path: string };
let segments: Record<string, ReturnType<typeof segment>[]>;
let entries: Record<string, ReturnType<typeof entry>[]>;
let segmentWrites: Write[];
let entryWrites: Write[];
let reads: string[];
let recomputes: string[];
let beforeSegmentWrite: ((write: Write) => Promise<Response | undefined> | undefined) | undefined;
let beforeEntryWrite: ((write: Write) => Promise<Response | undefined> | undefined) | undefined;
let segmentReadStatus: number;
let recomputeStatus: number;

beforeEach(() => {
  localStorage.clear(); resetToasts(); __resetTravelRecomputeState();
  segments = { t1: [segment()], t2: [segment('t2')] };
  entries = { t1: [entry(11, 't1'), entry(12, 't1')], t2: [entry(11, 't2'), entry(12, 't2')] };
  segmentWrites = []; entryWrites = []; reads = []; recomputes = [];
  beforeSegmentWrite = undefined; beforeEntryWrite = undefined; segmentReadStatus = 200; recomputeStatus = 200;
  Element.prototype.scrollIntoView = vi.fn(); Element.prototype.scrollTo = vi.fn(); window.scrollTo = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'https://test');
    if (url.pathname === '/api/oauth/userinfo') return response({ id: 'owner', email: 'owner@test.com', displayName: 'Owner' });
    if (url.pathname === '/api/my-trips') return response([{ tripId: 't1', name: '甲行程' }, { tripId: 't2', name: '乙行程' }]);
    const match = url.pathname.match(/^\/api\/trips\/(t[12])(?:\/(.*))?$/);
    if (!match) return response([]);
    const tripId = match[1]!; const tail = match[2] ?? ''; const method = init?.method ?? 'GET';
    const day = { id: 1, dayNum: 1, date: '2026-09-24', dayOfWeek: '四', label: '第一天', timeline: entries[tripId] };
    if (!tail) return response({ id: tripId, name: `${tripId}行程`, published: 1, countries: 'JP' });
    if (tail === 'days') return response([day]);
    if (tail === 'days/1') return response(day);
    if (tail === 'segments' && method === 'GET') { reads.push(tripId); return response(segments[tripId], segmentReadStatus); }
    if (tail.startsWith('segments') && method !== 'GET') {
      const write = { tripId, method, body: JSON.parse(String(init?.body)), path: tail };
      segmentWrites.push(write);
      const intercepted = await beforeSegmentWrite?.(write); if (intercepted) return intercepted;
      const prior = segments[tripId]![0] ?? segment(tripId);
      const body = write.body;
      const saved = { ...prior, ...body, min: typeof body.min === 'number' ? body.min : 14,
        source: typeof body.min === 'number' ? 'manual' : 'google', noTravel: body.noTravel ? 1 : null, computedAt: 2, version: prior.version + 1 } as ReturnType<typeof segment>;
      segments[tripId] = [saved];
      return response(saved, method === 'POST' ? 201 : 200);
    }
    if (tail === 'recompute-travel') { recomputes.push(`${tripId}:${url.searchParams.get('day')}`); return response({}, recomputeStatus); }
    if (tail.startsWith('entries/')) {
      const target = entries[tripId]!.find((e) => e.id === Number(tail.split('/')[1]))!;
      if (method === 'GET') return response(target);
      const write = { tripId, method, body: JSON.parse(String(init?.body)), path: tail }; entryWrites.push(write);
      const intercepted = await beforeEntryWrite?.(write); if (intercepted) return intercepted;
      if ('description' in write.body) target.description = String(write.body.description ?? '');
      return response(target);
    }
    return response([]);
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function Workspace() {
  const { tripId = 't1' } = useParams(); const location = useLocation(); const navigate = useNavigate();
  return <>
    <Link to="/trip/t1">甲時間軸</Link><Link to="/trip/t2">乙時間軸</Link>
    <Link to="/trip/t1/stop/12/edit">編輯甲</Link><Link to="/trip/t2/stop/12/edit">編輯乙</Link>
    <output data-testid="location">{location.pathname}{location.search}</output>
    <TripPage tripId={tripId} noShell />
    <SheetStackProvider value={{ inStack: true, closeStack: () => navigate("/trip/t1") }}>
      <Routes><Route path="stop/:entryId/edit" element={<EditEntryPage />} /></Routes>
    </SheetStackProvider>
  </>;
}
async function open(edit = false, guarded = false) {
  if (guarded) {
    const router = createMemoryRouter([{path: "/trip/:tripId/*", element: <ActiveTripProvider><Workspace /></ActiveTripProvider>}], {initialEntries:["/trip/t1/stop/12/edit"]});
    render(<RouterProvider router={router} />);
    await screen.findByTestId("edit-entry-mode-section");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    await tick(250);
    return router;
  }
  render(<MemoryRouter initialEntries={[`/trip/t1${edit ? '/stop/12/edit' : ''}`]}><ActiveTripProvider><Routes>
    <Route path="/trip/:tripId/*" element={<Workspace />} />
  </Routes></ActiveTripProvider></MemoryRouter>);
  if (edit) await screen.findByTestId('edit-entry-mode-section');
  else await screen.findByText('t1景點12');
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  await tick(250);
}
async function tick(ms = 250) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
function timeline() { return within(document.querySelector<HTMLElement>('section[data-day="1"]')!); }
async function dialog() { fireEvent.click(timeline().getByTestId('travel-pill')); await tick(0); }

describe('兩個真實交通編輯入口的 segment 生命週期', () => {
  it('dialog 在缺少 segment 時 POST pair，並顯示新交通方式', async () => {
    segments.t1 = [];
    recomputeStatus = 500;
    await open();
    await dialog();
    fireEvent.click(screen.getByTestId('travel-method-walking'));
    await tick(400);
    expect(segmentWrites).toMatchObject([{ method: 'POST', body: { from_entry_id: 11, to_entry_id: 12, mode: 'walking' } }]);
    expect(timeline().getByText('14 min')).toBeInTheDocument();
  });

  it('dialog 的 409 以 camelCase segment 清單取得版本後重試 PATCH', async () => {
    let conflict = true;
    beforeSegmentWrite = () => {
      if (!conflict) return undefined;
      conflict = false;
      return Promise.resolve(response({ error: { code: 'STALE_ENTRY', message: 'stale' } }, 409));
    };
    await open(); await dialog();
    fireEvent.click(screen.getByTestId('travel-method-walking'));
    await tick(500);
    expect(segmentWrites).toHaveLength(2);
    expect(segmentWrites[1]!.body).toMatchObject({ mode: 'walking', expectedVersion: 1 });
  });

  it('dialog 快速改方式及分鐘時保留最後的手填 transit', async () => {
    await open(); await dialog();
    fireEvent.click(screen.getByTestId('travel-method-walking'));
    fireEvent.click(screen.getByTestId('travel-method-train'));
    fireEvent.change(screen.getByTestId('travel-min-input'), { target: { value: '27' } });
    fireEvent.blur(screen.getByTestId('travel-min-input'));
    await tick(700);
    expect(segmentWrites.at(-1)!.body).toMatchObject({ mode: 'transit', submode: 'train', min: 27 });
  });

  it('dialog 免交通與恢復方式保留 noTravel 語意', async () => {
    await open(); await dialog();
    fireEvent.click(screen.getByTestId('travel-method-sameplace'));
    await tick(300);
    expect(segmentWrites.at(-1)!.body).toHaveProperty('noTravel', true);
  });

  it('entry 編輯在缺少 segment 時 POST pair，並保留無版本要求', async () => {
    segments.t1 = [];
    recomputeStatus = 500;
    await open(true);
    fireEvent.click(screen.getByTestId('edit-entry-mode-walking'));
    await tick(900);
    expect(segmentWrites).toMatchObject([{ method: 'POST', body: { from_entry_id: 11, to_entry_id: 12, mode: 'walking', submode: null } }]);
    expect(segmentWrites[0]!.body).not.toHaveProperty('expectedVersion');
    await tick(300);
    expect(timeline().getByText('14 min')).toBeInTheDocument();
  });

  it('entry 編輯的 409 保留原本失敗提示而不自行加版本重送', async () => {
    beforeSegmentWrite = () => Promise.resolve(response({ error: { code: 'STALE_ENTRY' } }, 409));
    await open(true);
    fireEvent.click(screen.getByTestId('edit-entry-mode-walking'));
    await tick(900);
    expect(segmentWrites).toHaveLength(1);
    expect(segmentWrites[0]!.body).not.toHaveProperty('expectedVersion');
    expect(screen.getByText('移動方式儲存失敗 (409)')).toBeInTheDocument();
  });

  it('entry 編輯更新交通後刷新 timeline，且不強制帶版本', async () => {
    await open(true);
    fireEvent.click(screen.getByTestId('edit-entry-mode-walking'));
    await tick(900);
    expect(segmentWrites).toMatchObject([{ tripId: 't1', method: 'PATCH', body: { mode: 'walking', submode: null } }]);
    expect(segmentWrites[0]!.body).not.toHaveProperty('expectedVersion');
    await tick(300);
    expect(reads.filter((id) => id === 't1').length).toBeGreaterThan(1);
    expect(timeline().getByText('14 min')).toBeInTheDocument();
  });

  it('entry 編輯的 A→B→A 晚到儲存不刷新新的 A 畫面', async () => {
    let release!: () => void;
    beforeSegmentWrite = () => new Promise((resolve) => { release = () => resolve(undefined); });
    await open(true);
    fireEvent.click(screen.getByTestId('edit-entry-mode-walking'));
    await tick(900);
    expect(segmentWrites).toHaveLength(1);
    fireEvent.click(screen.getByText('乙時間軸')); await tick();
    fireEvent.click(screen.getByText('甲時間軸')); await tick();
    const readsBefore = [...reads];
    await act(async () => { release(); }); await tick(600);
    expect(reads).toEqual(readsBefore);
    expect(timeline().getByText('10 min')).toBeInTheDocument();
  });

  it('entry 已儲存但 segment 失敗時，重試只送尚未成功的交通修改', async () => {
    let fails = true;
    beforeSegmentWrite = () => fails ? Promise.resolve(response({ error: 'temporary' }, 500)) : undefined;
    await open(true);
    fireEvent.change(screen.getByTestId('edit-entry-description-input'), { target: { value: '已修改' } });
    fireEvent.click(screen.getByTestId('edit-entry-mode-walking'));
    await tick(900);
    expect(entryWrites).toHaveLength(1);
    expect(segmentWrites).toHaveLength(1);
    expect(entryWrites[0]!.body).toHaveProperty('description', '已修改');
    fails = false;
    fireEvent.click(screen.getByTestId('edit-entry-mode-driving'));
    fireEvent.click(screen.getByTestId('edit-entry-mode-walking'));
    await tick(900);
    expect(entryWrites).toHaveLength(1);
    expect(segmentWrites).toHaveLength(2);
  });

  it('segment 網路中斷時仍記住已成功的 entry，重試不重送 entry', async () => {
    let fails = true;
    beforeSegmentWrite = () => fails ? Promise.reject(new TypeError('network lost')) : undefined;
    await open(true);
    fireEvent.change(screen.getByTestId('edit-entry-description-input'), { target: { value: '已修改' } });
    fireEvent.click(screen.getByTestId('edit-entry-mode-walking'));
    await tick(900);
    expect(entryWrites).toHaveLength(1);
    expect(segmentWrites).toHaveLength(1);
    expect(screen.getByText(/移動方式儲存失敗/)).toBeInTheDocument();
    fails = false;
    fireEvent.click(screen.getByTestId('edit-entry-mode-driving'));
    fireEvent.click(screen.getByTestId('edit-entry-mode-walking'));
    await tick(900);
    expect(entryWrites).toHaveLength(1);
    expect(segmentWrites).toHaveLength(2);
  });

  it('segment 已儲存但 entry 失敗時，重試不重送交通修改', async () => {
    let fails = true;
    beforeEntryWrite = () => fails ? Promise.resolve(response({ error: 'temporary' }, 500)) : undefined;
    await open(true);
    fireEvent.change(screen.getByTestId('edit-entry-description-input'), { target: { value: '已修改' } });
    fireEvent.click(screen.getByTestId('edit-entry-mode-walking'));
    await tick(900);
    expect(entryWrites).toHaveLength(1);
    expect(segmentWrites).toHaveLength(1);
    fails = false;
    fireEvent.change(screen.getByTestId('edit-entry-description-input'), { target: { value: '稍後再改' } });
    await tick(900);
    expect(entryWrites).toHaveLength(2);
    expect(segmentWrites).toHaveLength(1);
  });

  it('segment 已儲存但重讀失敗時不重送修改', async () => {
    await open(true);
    segmentReadStatus = 500;
    fireEvent.click(screen.getByTestId('edit-entry-mode-walking'));
    await tick(1400);
    expect(segmentWrites).toHaveLength(1);
    expect(reads.filter((id) => id === 't1').length).toBeGreaterThan(1);
    await tick(1800);
    expect(segmentWrites).toHaveLength(1);
  });

  it('dialog 的 A→B→A 晚到儲存不刷新新的 A 畫面', async () => {
    let release!: () => void;
    beforeSegmentWrite = () => new Promise((resolve) => { release = () => resolve(undefined); });
    await open(); await dialog();
    fireEvent.click(screen.getByTestId('travel-method-walking')); await tick(0);
    expect(segmentWrites).toHaveLength(1);
    fireEvent.click(screen.getByText('乙時間軸')); await tick();
    fireEvent.click(screen.getByText('甲時間軸')); await tick();
    const readsBefore = [...reads];
    await act(async () => { release(); }); await tick(600);
    expect(reads).toEqual(readsBefore);
    expect(timeline().getByText('10 min')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/trip/t1');
  });
});


it('保存超過 1.2 秒時切換行程仍保留編輯頁，成功後才接續目標', async () => {
  let release!: () => void;
  beforeEntryWrite = async () => { await new Promise<void>(resolve => { release = resolve; }); return undefined; };
  await open(true, true);
  fireEvent.change(screen.getByTestId('edit-entry-description-input'), {target:{value:'尚未保存的新內容'}});
  fireEvent.click(screen.getByText('乙時間軸'));
  await tick(1500);
  expect(screen.getByTestId('location').textContent).toBe('/trip/t1/stop/12/edit');
  expect(entryWrites).toHaveLength(1);
  await act(async () => { release(); });
  await tick(0);
  expect(screen.getByTestId('location').textContent).toBe('/trip/t2');
});

it('browser back 保存失敗時留在頁面，重試成功才返回原目的地', async () => {
  beforeEntryWrite = () => response({error:'unavailable'},503);
  const router = await open(true, true);
  await act(async () => { await router!.navigate('/trip/t2'); await router!.navigate('/trip/t1/stop/12/edit'); });
  await tick(0);
  fireEvent.change(screen.getByTestId('edit-entry-description-input'), {target:{value:'不能遺失'}});
  await act(async () => { await router!.navigate(-1); });
  await tick(0);
  expect(screen.getByTestId('location').textContent).toBe('/trip/t1/stop/12/edit');
  expect(screen.getByRole('alertdialog')).toHaveTextContent('尚有未儲存');
  const attempts = entryWrites.length;
  await tick(2500);
  expect(entryWrites).toHaveLength(attempts);
  beforeEntryWrite = undefined;
  fireEvent.click(screen.getByRole('button',{name:'重試儲存'}));
  await tick(0);
  expect(screen.getByTestId('location').textContent).toBe('/trip/t2');
});

it('備註保存失敗後可留在頁面，明確放棄才離開且不再重送', async () => {
  beforeEntryWrite = () => response({error:'unavailable'},503);
  await open(true, true);
  fireEvent.click(screen.getByTestId('edit-entry-poi-note-read-1012'));
  fireEvent.change(screen.getByTestId('edit-entry-poi-note-input-1012'), {target:{value:'保留我的備註'}});
  fireEvent.click(screen.getByText('乙時間軸'));
  await tick(0);
  expect(screen.getByRole('alertdialog')).toHaveTextContent('尚有未儲存');
  fireEvent.click(screen.getByRole('button',{name:'留在此頁'}));
  await tick(0);
  expect(screen.getByTestId('location').textContent).toBe('/trip/t1/stop/12/edit');
  expect(screen.getByTestId('edit-entry-poi-note-input-1012')).toHaveValue('保留我的備註');
  fireEvent.click(screen.getByText('乙時間軸'));
  await tick(0);
  fireEvent.click(screen.getByRole('button',{name:'放棄未儲存內容並離開'}));
  await tick(0);
  expect(screen.getByTestId('location').textContent).toBe('/trip/t2');
  const writes = entryWrites.length;
  await tick(2500);
  expect(entryWrites).toHaveLength(writes);
});


it('關閉操作面板時可以留在頁面，晚到的保存成功不會再觸發離開', async () => {
  let release!: () => void;
  beforeEntryWrite = async () => { await new Promise<void>(resolve => { release = resolve; }); return undefined; };
  await open(true, true);
  fireEvent.change(screen.getByTestId('edit-entry-description-input'), {target:{value:'正在保存'}});
  const unload = new Event('beforeunload',{cancelable:true});
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByTestId('stack-panel-close'));
  await tick(0);
  fireEvent.click(screen.getByRole('button',{name:'留在此頁'}));
  await act(async () => { release(); });
  await tick(0);
  expect(screen.getByTestId('location').textContent).toBe('/trip/t1/stop/12/edit');
  fireEvent.click(screen.getByTestId('stack-panel-close'));
  await tick(0);
  expect(screen.getByTestId('location').textContent).toBe('/trip/t1');
  expect(entryWrites).toHaveLength(1);
});
