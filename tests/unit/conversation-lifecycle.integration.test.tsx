import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatPage from '../../src/pages/ChatPage';
import TripSheet from '../../src/components/trip/TripSheet';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';

class RequestEvents {
  static instances: RequestEvents[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) { RequestEvents.instances.push(this); }
  close() { this.closed = true; }
  emit(data: unknown) { if (!this.closed) this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) })); }
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const makeRow = (id: number, tripId = 't1', message = `訊息 ${id}`, status = 'completed') => ({
  id, tripId, message, status, reply: status === 'completed' ? `回覆 ${id}` : null, terminalReason: null,
  createdAt: `2026-09-21T01:${String(id % 60).padStart(2, '0')}:00Z`, updatedAt: '2026-09-21T03:00:00Z',
});
type Row = ReturnType<typeof makeRow>;
let rows: Row[];
let historyGate: ((tripId: string, before: string | null, snapshot: Row[]) => Promise<Response> | undefined) | undefined;
let postGate: (() => Promise<void>) | undefined;
let detailGate: ((id: number, snapshot: Row | undefined) => Promise<Response> | undefined) | undefined;
let posts: Row[];
let postStatus = 200;
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
beforeEach(() => {
  localStorage.clear(); rows = []; posts = []; historyGate = undefined; postGate = undefined; detailGate = undefined; postStatus = 200;
  RequestEvents.instances = [];
  Element.prototype.scrollIntoView = vi.fn(); Element.prototype.scrollTo = vi.fn(); window.scrollTo = vi.fn();
  vi.stubGlobal('EventSource', RequestEvents);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'https://test');
    if (url.pathname === '/api/oauth/userinfo') return response({ id: 'owner', email: 'owner@test.com', displayName: 'Owner' });
    if (url.pathname === '/api/my-trips') return response([{ tripId: 't1', name: '甲行程' }, { tripId: 't2', name: '乙行程' }]);
    if (url.pathname === '/api/account/ai-authorization') return response({ authorized: true });
    if (url.pathname === '/api/requests') {
      if (init?.method === 'POST') {
        if (postStatus !== 200) return response({ error: '送出服務暫時失敗' }, postStatus);
        const body = JSON.parse(String(init.body));
        const row = makeRow(42 + posts.length, body.tripId, body.message, 'open');
        rows.push(row); posts.push(row); await postGate?.();
        return response(row);
      }
      const tripId = url.searchParams.get('tripId')!;
      const snapshot = structuredClone(rows.filter((row) => row.tripId === tripId).toReversed());
      return historyGate?.(tripId, url.searchParams.get('beforeId'), snapshot) ?? response({ items: snapshot, hasMore: false });
    }
    const match = url.pathname.match(/^\/api\/requests\/(\d+)$/);
    if (match) {
      const id = Number(match[1]); const row = rows.find((item) => item.id === id);
      return detailGate?.(id, structuredClone(row)) ?? response(row);
    }
    return response([]);
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function show(sheet = false) { return render(<MemoryRouter initialEntries={['/chat?sheet=chat']}><ActiveTripProvider>
  {sheet ? <TripSheet tripId="t1" allPins={[]} pinsByDay={new Map()} /> : <ChatPage />}
</ActiveTripProvider></MemoryRouter>); }
async function send(text: string, waitUntilReady = true) {
  if (waitUntilReady) await waitFor(() => expect(screen.getByTestId('chat-input')).not.toBeDisabled());
  await act(async () => { fireEvent.change(screen.getByTestId('chat-input'), { target: { value: text } }); });
  await act(async () => { fireEvent.click(screen.getByTestId('chat-send')); });
}
async function pick(id: string) {
  fireEvent.click(screen.getByTestId('chat-trip-title'));
  fireEvent.click(await screen.findByTestId(`chat-trip-pick-${id}`));
}

describe('conversation lifecycle through the real chat', () => {
  it('the sheet can send after a POST failure and receive a reply via polling after SSE disconnects', async () => {
    show(true); await screen.findByTestId('chat-input');
    await waitFor(() => expect(screen.getByTestId('chat-input')).not.toBeDisabled());
    postStatus = 503;
    await send('第一筆送出失敗');
    await screen.findByText(/送出失敗：/);
    expect(screen.getByTestId('chat-input')).not.toBeDisabled();
    postStatus = 200;
    vi.useFakeTimers();
    await send('第二筆可正常回覆', false);
    const events = RequestEvents.instances.at(-1)!;
    await act(async () => { events.onerror?.(); });
    rows[0] = { ...rows[0]!, status: 'completed', reply: '斷線後由輪詢補回的成果' };
    await act(async () => { await vi.advanceTimersByTimeAsync(30_001); });
    expect(screen.getByText('斷線後由輪詢補回的成果')).toBeInTheDocument();
    expect(screen.getAllByTestId('chat-msg-user')).toHaveLength(2);
    expect(screen.getAllByTestId('chat-msg-assistant')).toHaveLength(2);
    expect(screen.getByTestId('chat-input')).not.toBeDisabled();
    await act(async () => { events.onopen?.(); events.emit({ status: 'processing' }); });
    expect(screen.queryByTestId('chat-stop-waiting')).not.toBeInTheDocument();
  });
  it('stale history cannot resume waiting after the same request has completed live', async () => {
    const history = deferred<Response>(); historyGate = () => history.promise;
    show(); await screen.findByTestId('chat-trip-title');
    await send('完成後不可重新等待');
    await waitFor(() => expect(posts).toHaveLength(1));
    const stale = { ...rows[0]! };
    rows[0] = { ...stale, status: 'completed', reply: '已完成且已顯示' };
    await act(async () => { RequestEvents.instances.at(-1)!.emit({ status: 'completed' }); });
    await screen.findByText('已完成且已顯示');
    detailGate = () => Promise.resolve(response(stale));
    await act(async () => { history.resolve(response({ items: [stale], hasMore: false })); });
    expect(screen.getByTestId('chat-input')).not.toBeDisabled();
    expect(screen.getByText('已完成且已顯示')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-stop-waiting')).not.toBeInTheDocument();
  });
  it('retries the initial history failure without deleting a message sent meanwhile', async () => {
    historyGate = () => Promise.resolve(response({ error: 'offline' }, 503));
    show(); await screen.findByTestId('chat-load-error-retry');
    await send('斷線期間送出');
    rows.unshift(makeRow(10)); historyGate = undefined;
    fireEvent.click(screen.getByTestId('chat-load-error-retry'));
    await screen.findByText('訊息 10');
    expect(screen.getByText('斷線期間送出')).toBeInTheDocument();
    expect(screen.getAllByTestId('chat-msg-user')).toHaveLength(2);
    expect(screen.getAllByTestId('chat-stop-waiting')).toHaveLength(1);
  });
  it('locks the composer during POST and does not send a second request before acknowledgement', async () => {
    const posted = deferred<void>(); postGate = () => posted.promise;
    show(); await screen.findByTestId('chat-trip-title');
    await send('只送出一次');
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(screen.getByTestId('chat-input')).toBeDisabled();
    await send('不應送出第二筆', false);
    expect(posts).toHaveLength(1);
    await act(async () => { posted.resolve(); });
    expect(screen.getAllByTestId('chat-stop-waiting')).toHaveLength(1);
  });
  it('discarded pagination cannot reappear after leaving and returning to the same trip', async () => {
    rows = [makeRow(10)]; const older = deferred<Response>();
    historyGate = (trip, before, snapshot) => trip === 't1'
      ? before ? older.promise : Promise.resolve(response({ items: snapshot, hasMore: true })) : undefined;
    show(); await screen.findByText('訊息 10');
    fireEvent.scroll(screen.getByTestId('chat-body'));
    await pick('t2'); await pick('t1');
    await screen.findByText('訊息 10');
    await act(async () => { older.resolve(response({ items: [makeRow(9, 't1', '舊讀取的歷史')], hasMore: false })); });
    expect(screen.queryByText('舊讀取的歷史')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('chat-msg-user')).toHaveLength(1);
  });
  it('a late poll from the old trip cannot close the new trip subscription', async () => {
    rows = [makeRow(42, 't1', '甲處理中', 'processing'), makeRow(43, 't2', '乙處理中', 'processing')];
    const oldPoll = deferred<Response>();
    detailGate = (id) => id === 42 ? oldPoll.promise : undefined;
    show(); await screen.findByText('甲處理中');
    await pick('t2'); await screen.findByText('乙處理中');
    await act(async () => { oldPoll.resolve(response({ ...rows[0], status: 'completed', reply: '甲完成' })); });
    rows[1] = { ...rows[1]!, status: 'completed', reply: '乙完成' };
    await act(async () => { RequestEvents.instances.at(-1)!.emit({ status: 'completed' }); });
    expect(await screen.findByText('乙完成')).toBeInTheDocument();
    expect(screen.queryByText('甲完成')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).not.toBeDisabled();
  });
  it('a late POST from the previous trip cannot lock or populate the new trip; returning resumes persisted progress', async () => {
    const posted = deferred<void>(); postGate = () => posted.promise;
    show(); await screen.findByTestId('chat-trip-title');
    await send('甲行程的要求');
    await waitFor(() => expect(posts).toHaveLength(1));
    await pick('t2');
    await act(async () => { posted.resolve(); });
    expect(screen.getByTestId('chat-input')).not.toBeDisabled();
    expect(screen.queryByText('甲行程的要求')).not.toBeInTheDocument();
    await pick('t1');
    await screen.findByText('甲行程的要求');
    expect(screen.getByTestId('chat-input')).toBeDisabled();
    expect(screen.getAllByTestId('chat-stop-waiting')).toHaveLength(1);
    expect(posts).toHaveLength(1);
  });
  it('merges a persisted reply that arrives before the POST response without duplicate bubbles or waiting', async () => {
    const history = deferred<Response>(); const posted = deferred<void>();
    historyGate = () => history.promise; postGate = () => posted.promise;
    show(); await screen.findByTestId('chat-trip-title');
    await send('先完成後收到送出回應');
    await waitFor(() => expect(posts).toHaveLength(1));
    rows[0] = { ...rows[0]!, status: 'completed', reply: '工作已完成' };
    await act(async () => { history.resolve(response({ items: rows, hasMore: false })); posted.resolve(); });
    await screen.findByText('工作已完成');
    expect(screen.getAllByTestId('chat-msg-user')).toHaveLength(1);
    expect(screen.getAllByTestId('chat-msg-assistant')).toHaveLength(1);
    expect(screen.queryByTestId('chat-stop-waiting')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).not.toBeDisabled();
  });
  it('initial history arriving after a send preserves the local conversation', async () => {
    const history = deferred<Response>();
    historyGate = () => history.promise;
    show(); await screen.findByTestId('chat-trip-title');
    await send('歷史載入時送出');
    expect(await screen.findByText('歷史載入時送出')).toBeInTheDocument();
    await act(async () => { history.resolve(response({ items: [], hasMore: false })); });
    expect(screen.getByText('歷史載入時送出')).toBeInTheDocument();
    expect(screen.getAllByTestId('chat-msg-user')).toHaveLength(1);
    expect(screen.getAllByTestId('chat-stop-waiting')).toHaveLength(1);
  });
});
