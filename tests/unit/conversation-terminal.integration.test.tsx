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
const initialRow = { id: 42, tripId: 't1', message: '第一天加水族館', reply: null as string | null,
  status: 'processing', terminalReason: null as string | null, submittedBy: 'owner@test.com',
  createdAt: '2026-09-21T01:00:00Z', updatedAt: '2026-09-21T01:00:00Z' };
let row: typeof initialRow;
let history: typeof initialRow[];
let detailStatus = 200;
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  localStorage.clear();
  row = { ...initialRow }; history = [{ ...row }]; RequestEvents.instances = []; detailStatus = 200;
  Element.prototype.scrollIntoView = vi.fn(); Element.prototype.scrollTo = vi.fn(); window.scrollTo = vi.fn();
  vi.stubGlobal('EventSource', RequestEvents);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'https://test').pathname;
    if (path === '/api/oauth/userinfo') return response({ id: 'owner', email: 'owner@test.com', displayName: 'Owner' });
    if (path === '/api/my-trips') return response([{ tripId: 't1', name: '沖繩' }]);
    if (path === '/api/account/ai-authorization') return response({ authorized: true });
    if (path === '/api/requests') return response({ items: history, hasMore: false });
    if (path === '/api/requests/42') {
      if (init?.method === 'PATCH') row = { ...row, ...JSON.parse(String(init.body)) };
      return response(row, detailStatus);
    }
    return response([]);
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function show(surface: 'main' | 'sheet') {
  return render(<MemoryRouter initialEntries={['/chat?sheet=chat']}><ActiveTripProvider>
    {surface === 'main' ? <ChatPage /> : <TripSheet tripId="t1" allPins={[]} pinsByDay={new Map()} />}
  </ActiveTripProvider></MemoryRouter>);
}
async function expectStopped() {
  await waitFor(() => expect(screen.getByTestId('chat-input')).not.toBeDisabled());
  const bubble = screen.getByTestId('chat-msg-assistant');
  expect(bubble).toHaveClass('is-terminated');
  expect(bubble).not.toHaveClass('is-failed', 'is-pending');
  expect(bubble).toHaveTextContent('AI 若仍在處理');
}

describe('request terminal state in the real conversation', () => {
  it.each([
    ['[AI 健檢] secret system schema', '已觸發 AI 行程健檢'],
    ['[行程筆記-lodging-tips] secret system schema', '已觸發 AI 行程筆記生成（住宿在地建議）'],
    ['[行程筆記-tips] secret system schema', '已觸發 AI 行程筆記生成（行前須知）'],
    ['[行程筆記-emergency] secret system schema', '已觸發 AI 行程筆記生成（緊急聯絡）'],
    ['第一天加水族館', '第一天加水族館'],
  ])('shows the existing user-facing summary for %s', async (message, summary) => {
    history = [{ ...row, message, status: 'completed', reply: '已處理' }];
    show('main');
    expect(await screen.findByTestId('chat-msg-user')).toHaveTextContent(summary);
    expect(screen.queryByText(/secret system schema/)).not.toBeInTheDocument();
  });

  it.each([
    ['cancelled', null, 'AI 若仍在處理', 'is-terminated'],
    ['error', null, 'AI 處理失敗', 'is-failed'],
    ['needs_consent', '需要行程擁有者先授權。', '需要行程擁有者先授權', 'is-failed'],
    ['timed_out', null, 'AI 一直沒有回應', 'is-failed'],
  ])('polling and history agree on %s', async (terminalReason, reply, text, className) => {
    row = { ...row, status: 'failed', terminalReason, reply };
    show('sheet');
    await waitFor(() => expect(screen.getByTestId('chat-msg-assistant')).toHaveTextContent(text!));
    expect(screen.getByTestId('chat-msg-assistant')).toHaveClass(className!);
    expect(screen.getByTestId('chat-msg-assistant')).not.toHaveClass(className === 'is-failed' ? 'is-terminated' : 'is-failed');
    expect(screen.getByTestId('chat-input')).not.toBeDisabled();
    cleanup(); history = [{ ...row }];
    show('main');
    await waitFor(() => expect(screen.getByTestId('chat-msg-assistant')).toHaveTextContent(text!));
    expect(screen.getByTestId('chat-msg-assistant')).toHaveClass(className!);
    expect(screen.getByTestId('chat-input')).not.toBeDisabled();
  });

  it.each([
    ['failed', 'cancelled', null, '已停止等待'],
    ['failed', 'error', null, 'AI 處理失敗'],
    ['completed', null, null, 'AI 已完成，但沒有回覆內容'],
    ['completed', null, '已加入水族館', 'AI 已完成回覆'],
  ])('live result announces %s/%s and unlocks the composer', async (status, terminalReason, reply, announcement) => {
    show('main');
    await screen.findByTestId('chat-stop-waiting');
    await waitFor(() => expect(RequestEvents.instances.at(-1)?.onmessage).toBeTypeOf('function'));
    row = { ...row, status: status!, terminalReason, reply };
    await act(async () => { RequestEvents.instances.at(-1)!.emit({ status }); });
    await waitFor(() => expect(screen.getByRole('status', { name: '聊天狀態' })).toHaveTextContent(announcement!));
    expect(screen.getByRole('status', { name: '聊天狀態' })).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('chat-input')).not.toBeDisabled();
  });

  it('re-reading unchanged history is silent, while a late reply is announced once', async () => {
    row = { ...row, status: 'failed', terminalReason: 'cancelled' }; history = [{ ...row }];
    show('main'); await screen.findByText(/AI 若仍在處理/);
    const status = screen.getByRole('status', { name: '聊天狀態' });
    expect(status).toBeEmptyDOMElement();
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(status).toBeEmptyDOMElement();
    row = { ...row, reply: '遲到的回報' };
    await act(async () => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(status).toHaveTextContent('收到後續回報'));
    const observed = vi.fn(); const observer = new MutationObserver(observed);
    observer.observe(status, { childList: true, characterData: true, subtree: true });
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(observed).not.toHaveBeenCalled(); observer.disconnect();
  });

  it('retries missing terminal details instead of inventing an execution failure', async () => {
    show('main');
    await screen.findByTestId('chat-stop-waiting');
    await waitFor(() => expect(RequestEvents.instances.at(-1)?.onmessage).toBeTypeOf('function'));
    row = { ...row, status: 'failed', terminalReason: 'cancelled' }; detailStatus = 503;
    await act(async () => { RequestEvents.instances.at(-1)!.emit({ status: 'failed' }); });
    expect(screen.getByTestId('chat-msg-assistant')).not.toHaveClass('is-failed');
    detailStatus = 200;
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await expectStopped();
  });
  it('a completed request with no reply is terminal in both history and live polling', async () => {
    row = { ...row, status: 'completed', reply: null };
    history = [{ ...row }];
    show('main');
    await screen.findByText('第一天加水族館');
    expect(screen.queryByTestId('chat-stop-waiting')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-msg-assistant')).toHaveTextContent('沒有回覆內容');
    expect(screen.getByTestId('chat-input')).not.toBeDisabled();
    cleanup(); history = [{ ...initialRow }];
    show('sheet');
    await screen.findByText('（沒有回覆內容）');
    expect(screen.queryByTestId('chat-stop-waiting')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).not.toBeDisabled();
  });
  it('keeps the stopped bubble and composer unlocked when a late reply arrives by polling', async () => {
    show('main');
    await screen.findByTestId('chat-stop-waiting');
    await act(async () => { fireEvent.click(screen.getByTestId('chat-stop-waiting')); });
    await expectStopped();
    const bubble = screen.getByTestId('chat-msg-assistant');
    row = { ...row, reply: '水族館已加到行程，這是遲到的回報。' };
    vi.useFakeTimers();
    await act(async () => { window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(30_001); });
    expect(bubble).toHaveTextContent('這是遲到的回報');
    expect(screen.getAllByTestId('chat-msg-assistant')).toHaveLength(1);
    expect(screen.getByTestId('chat-msg-assistant')).toBe(bubble);
    expect(bubble).toHaveClass('is-terminated');
    expect(bubble).not.toHaveClass('is-failed', 'is-pending');
    expect(screen.getByTestId('chat-input')).not.toBeDisabled();
  });
  it.each(['main', 'sheet'] as const)('another tab stopping the request gives %s the same neutral result as history', async (surface) => {
    show(surface);
    await screen.findByTestId('chat-stop-waiting');
    await waitFor(() => expect(RequestEvents.instances.at(-1)?.onmessage).toBeTypeOf('function'));
    row = { ...row, status: 'failed', terminalReason: 'cancelled' };
    await act(async () => { RequestEvents.instances.at(-1)!.emit({ status: 'failed' }); });
    await expectStopped();
    cleanup(); history = [{ ...row }];
    show(surface);
    await screen.findByText(/AI 若仍在處理/);
    await expectStopped();
  });
});
