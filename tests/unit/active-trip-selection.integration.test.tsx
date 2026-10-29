import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatPage from '../../src/pages/ChatPage';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';
import { LS_KEY_TRIP_PREF, LS_PREFIX, lsGet, lsSet } from '../../src/lib/localStorage';
import { __clearMyTripsCache } from '../../src/hooks/useMyTrips';
import { EVENT } from '../../src/lib/events';

const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const trips = [
  { tripId: 't1', name: '私人甲行程', title: '甲旅程', countries: 'JP' },
  { tripId: 't2', name: '私人乙行程', title: '乙旅程', countries: 'TW' },
];
const requests = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
let listReply: () => Promise<Response>;
let currentUserId: string;

beforeEach(() => {
  localStorage.clear();
  __clearMyTripsCache();
  Element.prototype.scrollTo = vi.fn();
  window.scrollTo = vi.fn();
  requests.mockReset();
  currentUserId = 'owner';
  listReply = async () => response(trips);
  requests.mockImplementation(async (input) => {
    const url = new URL(String(input), 'https://test');
    if (url.pathname === '/api/oauth/userinfo') return response({ id: currentUserId, email: 'owner@test.com', displayName: 'Owner' });
    if (url.pathname === '/api/my-trips') return listReply();
    if (url.pathname === '/api/account/ai-authorization') return response({ authorized: true });
    if (url.pathname === '/api/requests') return url.searchParams.get('tripId') === 'shared-private'
      ? response({ error: 'forbidden' }, 403)
      : response({ items: [], hasMore: false });
    return response({});
  });
  vi.stubGlobal('fetch', requests);
});

it('清單讀取失敗不視為空清單，也不清掉已儲存的 active trip', async () => {
  lsSet(LS_KEY_TRIP_PREF, 't2');
  let finish!: (result: Response) => void;
  listReply = () => new Promise<Response>((resolve) => { finish = resolve; });
  render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  await waitFor(() => expect(requests.mock.calls.some(([input]) => String(input).endsWith('/api/my-trips'))).toBe(true));
  await act(async () => { finish(response({ error: '暫時故障' }, 503)); });
  expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('t2');
  expect(screen.queryByText('尚無行程')).not.toBeInTheDocument();
  expect(within(screen.getByTestId('sidebar-trips')).getByText('載入行程失敗，請稍後再試')).toBeInTheDocument();
});

it('沒有偏好且清單失敗時顯示讀取失敗，不誤顯成功空清單', async () => {
  listReply = async () => response({ error: '暫時故障' }, 503);
  render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  expect(await within(screen.getByTestId('chat-page')).findByText('載入行程失敗，請稍後再試')).toBeInTheDocument();
  expect(screen.queryByText('還沒有行程可以聊')).not.toBeInTheDocument();
});

it('暫時讀取失敗後重新進入聊天會重試可存取清單', async () => {
  listReply = async () => response({ error: '暫時故障' }, 503);
  const first = render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  await within(screen.getByTestId('chat-page')).findByText('載入行程失敗，請稍後再試');
  first.unmount();
  listReply = async () => response(trips);
  render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId('sidebar-trip-t1')).toHaveClass('is-active'));
  expect(requests.mock.calls.filter(([input]) => String(input).endsWith('/api/my-trips'))).toHaveLength(2);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('聊天與側欄共用私人行程清單，重新掛載後沿用偏好並共同標示選擇', async () => {
  lsSet(LS_KEY_TRIP_PREF, 't2');
  const first = render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  expect(await screen.findByText('乙旅程')).toBeInTheDocument();
  expect(await screen.findByTestId('sidebar-trip-t2')).toHaveClass('is-active');
  expect(screen.getByTestId('sidebar-trip-t2')).toHaveTextContent('私人乙行程');
  first.unmount();
  render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  expect(await screen.findByTestId('sidebar-trip-t2')).toHaveClass('is-active');
  await waitFor(() => expect(requests.mock.calls.filter(([input]) => String(input).endsWith('/api/my-trips'))).toHaveLength(1));
});

it('保存的偏好失效時選第一個可存取行程', async () => {
  lsSet(LS_KEY_TRIP_PREF, 'removed-trip');
  render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId('sidebar-trip-t1')).toHaveClass('is-active'));
  expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('t1');
});

it('成功確認空清單後清除失效偏好並保留聊天原空狀態', async () => {
  lsSet(LS_KEY_TRIP_PREF, 'removed-trip');
  listReply = async () => response([]);
  render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  expect(await screen.findByText('還沒有行程可以聊')).toBeInTheDocument();
  expect(screen.getByText('尚無行程')).toBeInTheDocument();
  expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBeNull();
});

it('跨瀏覽器分頁的偏好變更同步到聊天與側欄', async () => {
  lsSet(LS_KEY_TRIP_PREF, 't1');
  render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  await screen.findByTestId('sidebar-trip-t2');
  await waitFor(() => expect(screen.getByTestId('sidebar-trip-t1')).toHaveClass('is-active'));
  lsSet(LS_KEY_TRIP_PREF, 't2');
  const key = `${LS_PREFIX}${LS_KEY_TRIP_PREF}`;
  act(() => window.dispatchEvent(new StorageEvent('storage', { key, newValue: localStorage.getItem(key) })));
  expect(await screen.findByText('乙旅程')).toBeInTheDocument();
  expect(screen.getByTestId('sidebar-trip-t2')).toHaveClass('is-active');
});

it('換帳號重新掛載後不沿用上一位使用者的可存取行程清單', async () => {
  const first = render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  await screen.findByTestId('sidebar-trip-t1');
  first.unmount();
  currentUserId = 'other';
  listReply = async () => response([{ tripId: 'other-trip', name: '其他帳號行程' }]);
  render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  expect(await screen.findByTestId('sidebar-trip-other-trip')).toHaveTextContent('其他帳號行程');
  expect(screen.queryByTestId('sidebar-trip-t1')).not.toBeInTheDocument();
  expect(requests.mock.calls.filter(([input]) => String(input).endsWith('/api/my-trips'))).toHaveLength(2);
});

it('明確指定的聊天目標即使不在清單仍保留，由對話讀取判定權限', async () => {
  lsSet(LS_KEY_TRIP_PREF, 't2');
  render(<MemoryRouter initialEntries={['/chat?tripId=shared-private']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  await waitFor(() => expect(requests.mock.calls.some(([input]) => String(input).includes('/api/requests?tripId=shared-private'))).toBe(true));
  expect(await screen.findByTestId('chat-load-error')).toBeInTheDocument();
  expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('shared-private');
  expect(screen.getByTestId('chat-input')).not.toBeDisabled();
});

it('明確連結開啟後仍接受另一分頁後續改變的 active trip', async () => {
  render(<MemoryRouter initialEntries={['/chat?tripId=shared-private']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  await waitFor(() => expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('shared-private'));
  lsSet(LS_KEY_TRIP_PREF, 't2');
  const key = `${LS_PREFIX}${LS_KEY_TRIP_PREF}`;
  act(() => window.dispatchEvent(new StorageEvent('storage', { key, newValue: localStorage.getItem(key) })));
  expect(await screen.findByText('乙旅程')).toBeInTheDocument();
  expect(screen.getByTestId('sidebar-trip-t2')).toHaveClass('is-active');
});

it('嵌入行程 sheet 的聊天固定使用該行程，不受偏好與清單缺項影響', async () => {
  lsSet(LS_KEY_TRIP_PREF, 't2');
  listReply = async () => response([trips[1]]);
  render(<MemoryRouter><ActiveTripProvider><ChatPage embedded lockTripId="t1" /></ActiveTripProvider></MemoryRouter>);
  await waitFor(() => expect(requests.mock.calls.some(([input]) => String(input).includes('/api/requests?tripId=t1'))).toBe(true));
  expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('t1');
  expect(screen.queryByTestId('chat-trip-title')).not.toBeInTheDocument();
});

it('刷新中的選擇與較新清單優先，舊回應不覆蓋聊天和側欄', async () => {
  lsSet(LS_KEY_TRIP_PREF, 't1');
  render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  await screen.findByTestId('sidebar-trip-t2');
  let finishOld!: (result: Response) => void;
  listReply = () => new Promise<Response>((resolve) => { finishOld = resolve; });
  act(() => window.dispatchEvent(new CustomEvent(EVENT.tripUpdated, { detail: { tripId: 't2' } })));
  await waitFor(() => expect(finishOld).toBeTypeOf('function'));
  fireEvent.click(screen.getByTestId('chat-trip-title'));
  fireEvent.click(await screen.findByTestId('chat-trip-pick-t2'));
  expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('t2');
  listReply = async () => response([{ ...trips[0] }, { ...trips[1], title: '乙新旅程', name: '私人乙新名稱' }]);
  act(() => window.dispatchEvent(new CustomEvent(EVENT.tripUpdated, { detail: { tripId: 't2' } })));
  expect(await screen.findByText('乙新旅程')).toBeInTheDocument();
  expect(screen.getByTestId('sidebar-trip-t2')).toHaveTextContent('私人乙新名稱');
  await act(async () => { finishOld(response([trips[0]])); });
  expect(screen.getByTestId('chat-trip-title')).toHaveTextContent('乙新旅程');
  expect(screen.getByTestId('sidebar-trip-t2')).toHaveClass('is-active');
  expect(lsGet<string>(LS_KEY_TRIP_PREF)).toBe('t2');
});

it('新增行程通知讓聊天選單與側欄同時看到新行程', async () => {
  render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  await screen.findByTestId('sidebar-trip-t2');
  listReply = async () => response([...trips, { tripId: 't3', name: '私人新增行程', title: '丙旅程' }]);
  act(() => window.dispatchEvent(new CustomEvent(EVENT.tripCreated, { detail: { tripId: 't3' } })));
  expect(await screen.findByTestId('sidebar-trip-t3')).toHaveTextContent('私人新增行程');
  fireEvent.click(screen.getByTestId('chat-trip-title'));
  expect(await screen.findByTestId('chat-trip-pick-t3')).toHaveTextContent('丙旅程');
});

it('離開聊天期間收到新增通知，重新掛載後不顯示過期快取', async () => {
  const first = render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  await screen.findByTestId('sidebar-trip-t2');
  first.unmount();
  listReply = async () => response([...trips, { tripId: 't3', name: '離開期間新增' }]);
  act(() => window.dispatchEvent(new CustomEvent(EVENT.tripCreated, { detail: { tripId: 't3' } })));
  render(<MemoryRouter initialEntries={['/chat']}><ActiveTripProvider><ChatPage /></ActiveTripProvider></MemoryRouter>);
  expect(await screen.findByTestId('sidebar-trip-t3')).toHaveTextContent('離開期間新增');
});
