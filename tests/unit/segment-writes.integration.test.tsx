import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Link, MemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import EditEntryPage from '../../src/pages/EditEntryPage';
import TimelineRail from '../../src/components/trip/TimelineRail';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';
import { TripIdContext } from '../../src/contexts/TripIdContext';
import { TripDaysContext } from '../../src/contexts/TripDaysContext';
import { getToasts, resetToasts } from '../../src/lib/toastBus';
import { __resetTravelRecomputeState } from '../../src/lib/travelRecompute';

vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { email: 'owner@test.com' }, loading: false }),
}));
vi.mock('../../src/components/shell/AppShell', () => ({
  default: ({ main }: { main: React.ReactNode }) => <>{main}</>,
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

const reads = vi.fn<(path: string) => Promise<unknown>>();
const writes = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>();
let segments: Array<Record<string, unknown>>;
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string) => reads(path),
  apiFetchRaw: (path: string, init?: RequestInit) => writes(path, init),
}));

beforeEach(() => {
  resetToasts();
  __resetTravelRecomputeState();
  reads.mockReset();
  writes.mockReset();
  segments = [{ id: 9, tripId: 't1', fromEntryId: 41, toEntryId: 42,
    mode: 'driving', submode: null, min: 11, computedAt: 1, noTravel: null }];
  reads.mockImplementation(async (path) => {
    if (path.endsWith('/entries/42')) return { id: 42, dayId: 7, startTime: '12:00', endTime: '13:30', description: '原說明' };
    if (path.endsWith('/days')) return [{ id: 7, dayNum: 3 }];
    if (path.endsWith('/days/3')) return { id: 7, dayNum: 3, timeline: [
      { id: 41, master: { poiId: 91, name: '首里城' } },
      { id: 42, master: { poiId: 92, name: '花織そば' } },
    ] };
    if (path.endsWith('/segments')) return segments;
    return { id: 't1', name: '沖繩行程' };
  });
  writes.mockImplementation(async (path) => path.includes('/segments/9')
    ? new Response('{}', { status: 500 })
    : new Response('{}', { status: 200 }));
});

const railEntries: TimelineEntryData[] = [41, 42].map((id) => ({
  id, title: `景點 ${id}`, masterLat: 26 + id / 1000, masterLng: 127 + id / 1000,
  stopPois: [{ poiId: id + 100, sortOrder: 1, name: `景點 ${id}` }],
}));

function renderRail() {
  render(<MemoryRouter>
    <TripIdContext.Provider value="t1">
      <TripDaysContext.Provider value={[{ dayId: 7, dayNum: 3, label: 'Day 3', stopCount: 2 }]}>
        <TimelineRail events={railEntries} dayId={7} />
      </TripDaysContext.Provider>
    </TripIdContext.Provider>
  </MemoryRouter>);
}

function renderEdit() {
  const router = createMemoryRouter([
    { path: '/trip/:tripId/stop/:entryId/edit', element: <EditEntryPage /> },
  ], { initialEntries: ['/trip/t1/stop/42/edit'] });
  render(<RouterProvider router={router} />);
}

it('時間軸既有 segment 改方式後重讀並顯示新方式', async () => {
  writes.mockImplementation(async (path, init) => {
    if (path.endsWith('/segments/9')) {
      const body = JSON.parse(String(init?.body));
      segments = [{ ...segments[0], mode: body.mode, min: 6, computedAt: 2 }];
      return new Response(JSON.stringify({ ...segments[0], version: 2 }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
  renderRail();
  fireEvent.click(await screen.findByTestId('travel-pill'));
  fireEvent.click(screen.getByTestId('travel-method-walking'));
  await waitFor(() => expect(screen.getByTestId('travel-pill').getAttribute('aria-label')).toContain('步行'));
  expect(writes.mock.calls.filter(([path]) => path.endsWith('/segments/9'))).toHaveLength(1);
});

it('交通儲存成功後刷新失敗，保留已知畫面且不重送修改', async () => {
  const read = reads.getMockImplementation()!;
  let segmentReads = 0;
  reads.mockImplementation((path) => {
    if (path.endsWith('/segments') && ++segmentReads > 1) return Promise.reject(new Error('讀取失敗'));
    return read(path);
  });
  writes.mockImplementation(async (path) => path.endsWith('/segments/9')
    ? new Response(JSON.stringify({ ...segments[0], mode: 'walking', version: 2 }), { status: 200 })
    : new Response('{}', { status: 200 }));
  renderRail();
  fireEvent.click(await screen.findByTestId('travel-pill'));
  fireEvent.click(screen.getByTestId('travel-method-walking'));
  await waitFor(() => expect(segmentReads).toBe(2));
  await new Promise((resolve) => setTimeout(resolve, 750));
  expect(screen.getByTestId('travel-pill').getAttribute('aria-label')).toContain('開車');
  expect(writes.mock.calls.filter(([path]) => path.endsWith('/segments/9'))).toHaveLength(1);
  expect(getToasts().some((t) => t.type === 'error')).toBe(false);
});

it('時間軸缺少 segment 時可建立，成功重讀後顯示交通方式', async () => {
  segments = [];
  writes.mockImplementation(async (path, init) => {
    if (path.includes('/recompute-travel')) return new Promise<Response>(() => {});
    if (path.endsWith('/segments') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      segments = [{ id: 9, tripId: 't1', fromEntryId: 41, toEntryId: 42,
        mode: body.mode, submode: null, min: 6, computedAt: 2, noTravel: null }];
      return new Response(JSON.stringify({ ...segments[0], version: 1 }), { status: 201 });
    }
    return new Response('{}', { status: 200 });
  });
  renderRail();
  await screen.findByTestId('travel-pill-stale');
  await waitFor(() => expect(screen.getByTestId('travel-pill').tagName).toBe('BUTTON'));
  fireEvent.click(screen.getByTestId('travel-pill'));
  fireEvent.click(screen.getByTestId('travel-method-walking'));
  await waitFor(() => expect(screen.getByTestId('travel-pill').getAttribute('aria-label')).toContain('步行'));
  const post = writes.mock.calls.find(([path, init]) => path.endsWith('/segments') && init?.method === 'POST');
  expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ from_entry_id: 41, to_entry_id: 42, mode: 'walking' });
});

it('交通版本衝突後以 camelCase segment 重新讀取版本並完成原修改', async () => {
  let patchCount = 0;
  writes.mockImplementation(async (path, init) => {
    if (path.endsWith('/segments/9')) {
      patchCount++;
      if (patchCount === 1) return new Response(JSON.stringify({ error: { code: 'STALE_ENTRY', message: '版本已變更' } }), { status: 409 });
      segments = [{ ...segments[0], mode: 'walking', min: 6, computedAt: 2 }];
      return new Response(JSON.stringify({ ...segments[0], version: 4 }), { status: 200 });
    }
    if (path.endsWith('/segments') && !init?.method) {
      return new Response(JSON.stringify([{ ...segments[0], version: 3 }]), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
  renderRail();
  fireEvent.click(await screen.findByTestId('travel-pill'));
  fireEvent.click(screen.getByTestId('travel-method-walking'));
  await waitFor(() => expect(screen.getByTestId('travel-pill').getAttribute('aria-label')).toContain('步行'));
  expect(patchCount).toBe(2);
  const retry = writes.mock.calls.filter(([path]) => path.endsWith('/segments/9'))[1];
  expect(JSON.parse(String(retry?.[1]?.body)).expectedVersion).toBe(3);
});

it('快速改兩次交通方式，第一筆晚到後仍保留最後一次選擇', async () => {
  let release!: (response: Response) => void;
  let count = 0;
  writes.mockImplementation(async (path, init) => {
    if (path.endsWith('/segments/9')) {
      count++;
      const body = JSON.parse(String(init?.body));
      if (count === 1) return new Promise<Response>((resolve) => { release = resolve; });
      segments = [{ ...segments[0], mode: body.mode, min: 11, computedAt: 3 }];
      return new Response(JSON.stringify({ ...segments[0], version: 3 }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
  renderRail();
  fireEvent.click(await screen.findByTestId('travel-pill'));
  fireEvent.click(screen.getByTestId('travel-method-walking'));
  await waitFor(() => expect(count).toBe(1));
  fireEvent.click(screen.getByTestId('travel-method-driving'));
  segments = [{ ...segments[0], mode: 'walking', min: 6, computedAt: 2 }];
  release(new Response(JSON.stringify({ ...segments[0], version: 2 }), { status: 200 }));
  await waitFor(() => expect(count).toBe(2));
  await waitFor(() => expect(screen.getByTestId('travel-pill').getAttribute('aria-label')).toContain('開車'));
  const bodies = writes.mock.calls.filter(([path]) => path.endsWith('/segments/9'))
    .map(([, init]) => JSON.parse(String(init?.body)) as { mode: string });
  expect(bodies.map((body) => body.mode)).toEqual(['walking', 'driving']);
});

for (const create of [false, true]) {
  it(`entry 編輯${create ? '建立' : '更新'} segment 後可見刷新，且沿用不要求版本的契約`, async () => {
    if (create) segments = [];
    writes.mockImplementation(async (path, init) => {
      if (path.includes('/segments') && !path.includes('recompute-travel')) {
        const body = JSON.parse(String(init?.body));
        segments = [{ id: 9, tripId: 't1', fromEntryId: 41, toEntryId: 42,
          mode: body.mode, submode: null, min: 6, computedAt: 2, source: 'google', noTravel: null }];
        return new Response(JSON.stringify({ ...segments[0], version: 2 }), { status: create ? 201 : 200 });
      }
      return new Response('{}', { status: 200 });
    });
    renderEdit();
    fireEvent.click(await screen.findByTestId('edit-entry-mode-walking'));
    await waitFor(() => expect(writes.mock.calls.some(([path, init]) => path.endsWith(create ? '/segments' : '/segments/9')
      && init?.method === (create ? 'POST' : 'PATCH'))).toBe(true), { timeout: 2500 });
    await waitFor(() => expect(reads.mock.calls.filter(([path]) => path.endsWith('/segments'))).toHaveLength(2));
    expect(screen.getByTestId('edit-entry-mode-section').textContent).toContain('6 min');
    const write = writes.mock.calls.find(([path, init]) => path.endsWith(create ? '/segments' : '/segments/9')
      && init?.method === (create ? 'POST' : 'PATCH'));
    const body = JSON.parse(String(write?.[1]?.body));
    expect(body).toMatchObject(create
      ? { mode: 'walking', submode: null, from_entry_id: 41, to_entry_id: 42 }
      : { mode: 'walking', submode: null });
    expect(body.expectedVersion).toBeUndefined();
  });
}

it('entry 儲存成功但交通儲存失敗時，不重送已儲存的 entry 修改', async () => {
  const read = reads.getMockImplementation()!;
  reads.mockImplementation((path) => path.endsWith('/segments')
    ? Promise.resolve(segments.map((segment) => ({ ...segment })))
    : read(path));
  renderEdit();
  const description = await screen.findByTestId('edit-entry-description-input');
  await waitFor(() => expect(screen.getByTestId('edit-entry-mode-walking')).toBeTruthy());
  fireEvent.change(description, { target: { value: '新說明' } });
  fireEvent.click(screen.getByTestId('edit-entry-mode-walking'));
  await waitFor(() => expect(writes.mock.calls.filter(([path]) => path.includes('/segments/9'))).toHaveLength(1), { timeout: 2500 });
  await new Promise((resolve) => setTimeout(resolve, 1100));
  expect(writes.mock.calls.filter(([path]) => path.includes('/entries/42'))).toHaveLength(1);
  expect((description as HTMLTextAreaElement).value).toBe('新說明');
  expect(screen.getByTestId('edit-entry-mode-walking')).toHaveAttribute('aria-checked', 'true');
  expect(getToasts().some((t) => t.message.includes('移動方式') && t.type === 'error')).toBe(true);
});

it('交通儲存成功但 entry 失敗時，不重送已儲存的交通修改', async () => {
  writes.mockImplementation(async (path, init) => {
    if (path.endsWith('/entries/42')) return new Response('{}', { status: 500 });
    if (path.endsWith('/segments/9')) {
      const body = JSON.parse(String(init?.body));
      segments = [{ ...segments[0], mode: body.mode, min: 6, computedAt: 2 }];
      return new Response(JSON.stringify({ ...segments[0], version: 2 }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
  renderEdit();
  fireEvent.change(await screen.findByTestId('edit-entry-description-input'), { target: { value: '新說明' } });
  fireEvent.click(screen.getByTestId('edit-entry-mode-walking'));
  await waitFor(() => expect(writes.mock.calls.filter(([path]) => path.endsWith('/segments/9'))).toHaveLength(1), { timeout: 2500 });
  await new Promise((resolve) => setTimeout(resolve, 1100));
  expect(writes.mock.calls.filter(([path]) => path.endsWith('/segments/9'))).toHaveLength(1);
  expect(getToasts().some((t) => t.message.includes('景點儲存失敗') && t.type === 'error')).toBe(true);
});

it.each([false, true])('切換行程%s後晚到的交通失敗不顯示舊提示', async (returnToA) => {
  const readT1 = reads.getMockImplementation()!;
  reads.mockImplementation(async (path) => {
    if (!path.includes('/trips/t2')) return readT1(path);
    if (path.endsWith('/entries/52')) return { id: 52, dayId: 8, startTime: '13:00', endTime: '14:00', description: '乙說明' };
    if (path.endsWith('/days')) return [{ id: 8, dayNum: 4 }];
    if (path.endsWith('/days/4')) return { id: 8, dayNum: 4, timeline: [
      { id: 51, master: { poiId: 151, name: '乙前站' } },
      { id: 52, master: { poiId: 152, name: '乙景點' } },
    ] };
    if (path.endsWith('/segments')) return [{ id: 19, tripId: 't2', fromEntryId: 51, toEntryId: 52,
      mode: 'driving', submode: null, min: 8, computedAt: 1, noTravel: null }];
    return { id: 't2', name: '乙行程' };
  });
  let release!: (response: Response) => void;
  writes.mockImplementation(async (path) => path.endsWith('/segments/9')
    ? new Promise<Response>((resolve) => { release = resolve; })
    : new Response('{}', { status: 200 }));
  const router = createMemoryRouter([
    { path: '/trip/:tripId/stop/:entryId/edit', element: <>
      <Link to="/trip/t2/stop/52/edit">切換乙行程</Link>
      <Link to="/trip/t1/stop/42/edit">返回甲行程</Link>
      <EditEntryPage />
    </> },
  ], { initialEntries: ['/trip/t1/stop/42/edit'] });
  render(<RouterProvider router={router} />);
  fireEvent.click(await screen.findByTestId('edit-entry-mode-walking'));
  await waitFor(() => expect(writes.mock.calls.some(([path]) => path.endsWith('/segments/9'))).toBe(true), { timeout: 2500 });
  fireEvent.click(screen.getByText('切換乙行程'));
  await waitFor(() => expect(screen.getByText('放棄變更')).toBeInTheDocument(), { timeout: 1800 });
  expect(screen.getByTestId('edit-entry-description-input')).toHaveValue('原說明');
  fireEvent.click(screen.getByText('放棄變更'));
  await waitFor(() => expect(screen.getByTestId('edit-entry-description-input')).toHaveValue('乙說明'));
  if (returnToA) {
    fireEvent.click(screen.getByText('返回甲行程'));
    await waitFor(() => expect(screen.getByTestId('edit-entry-description-input')).toHaveValue('原說明'));
  }
  release(new Response('{}', { status: 500 }));
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(getToasts().some((t) => t.message.includes('移動方式儲存失敗'))).toBe(false);
  expect(screen.getByTestId('edit-entry-mode-driving')).toHaveAttribute('aria-checked', 'true');
});

it('新行程讀取緩慢時不把舊行程未儲存表單送到新行程', async () => {
  const readT1 = reads.getMockImplementation()!;
  let releaseRead!: (value: unknown) => void;
  reads.mockImplementation(async (path) => {
    if (path.endsWith('/trips/t2/entries/52')) return new Promise<unknown>((resolve) => { releaseRead = resolve; });
    return readT1(path);
  });
  let releaseWrite!: (response: Response) => void;
  writes.mockImplementation(async (path) => path.endsWith('/trips/t1/segments/9')
    ? new Promise<Response>((resolve) => { releaseWrite = resolve; })
    : new Response('{}', { status: 200 }));
  const router = createMemoryRouter([
    { path: '/trip/:tripId/stop/:entryId/edit', element: <>
      <Link to="/trip/t2/stop/52/edit">切換乙行程</Link>
      <EditEntryPage />
    </> },
  ], { initialEntries: ['/trip/t1/stop/42/edit'] });
  render(<RouterProvider router={router} />);
  fireEvent.click(await screen.findByTestId('edit-entry-mode-walking'));
  await waitFor(() => expect(writes.mock.calls.some(([path]) => path.endsWith('/trips/t1/segments/9'))).toBe(true), { timeout: 2500 });
  fireEvent.click(screen.getByText('切換乙行程'));
  await waitFor(() => expect(screen.getByText('放棄變更')).toBeInTheDocument(), { timeout: 1800 });
  expect(screen.getByTestId('edit-entry-description-input')).toHaveValue('原說明');
  fireEvent.click(screen.getByText('放棄變更'));
  expect(writes.mock.calls.some(([path]) => path.includes('/trips/t2/'))).toBe(false);
  releaseWrite(new Response('{}', { status: 200 }));
  releaseRead({ id: 52, dayId: 8, startTime: '13:00', endTime: '14:00', description: '乙說明' });
});
