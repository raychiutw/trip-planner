/**
 * useChatPagination — cursor pagination + scroll behavior 單元測試。
 *
 * 直接 renderHook 測試,避免整頁 render 的 setup 開銷。bodyRef 用一個帶 mutable
 * scrollTop/scrollHeight 的 fake element 模擬 DOM。apiFetch 全 mock。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRef } from 'react';

const apiFetchMock = vi.fn();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string) => apiFetchMock(path),
}));

import { useChatPagination } from '../../src/hooks/useChatPagination';

interface RawRequestRow {
  id: number;
  tripId: string;
  status: 'open' | 'processing' | 'completed' | 'failed';
  createdAt?: string | null;
  message?: string | null;
  reply?: string | null;
}

interface ChatMessage {
  id: number | string;
  role: 'user' | 'assistant';
  text: string;
}

function rowToMessages(row: RawRequestRow): ChatMessage[] {
  const out: ChatMessage[] = [];
  const baseId = row.id * 2;
  if (row.message) out.push({ id: baseId, role: 'user', text: row.message });
  if (row.status === 'completed' && row.reply) out.push({ id: baseId + 1, role: 'assistant', text: row.reply });
  return out;
}

function makeRow(id: number, opts: Partial<RawRequestRow> = {}): RawRequestRow {
  return {
    id,
    tripId: 'trip-A',
    status: 'completed',
    createdAt: `2026-04-${String(id).padStart(2, '0')}T10:00:00`,
    message: `msg ${id}`,
    reply: `reply ${id}`,
    ...opts,
  };
}

/** 模擬可寫 scrollTop/scrollHeight 的 DOM element 給 bodyRef 用。 */
function makeFakeBody(scrollHeight = 1000, scrollTop = 0): HTMLDivElement {
  const el = {
    scrollTop,
    scrollHeight,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  return el as unknown as HTMLDivElement;
}

interface UseHarnessArgs {
  activeTripId: string | null;
  initialMessages?: ChatMessage[];
  body?: HTMLDivElement;
  isInflight?: (row: RawRequestRow) => boolean;
  onResume?: (id: number | null) => void;
}

function useHarness({ activeTripId, initialMessages = [], body, isInflight, onResume }: UseHarnessArgs) {
  const messagesState = useRef<ChatMessage[]>(initialMessages);
  // 模擬 useState 的行為：簡化版
  const [, forceRender] = (function useForce() {
    const r = useRef(0);
    return [r.current, () => { r.current++; }] as const;
  })();
  const setMessages = (next: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    messagesState.current = typeof next === 'function' ? (next as (p: ChatMessage[]) => ChatMessage[])(messagesState.current) : next;
    forceRender();
  };
  const bodyRef = useRef<HTMLDivElement | null>(body ?? makeFakeBody());

  const result = useChatPagination<RawRequestRow, ChatMessage>({
    activeTripId,
    bodyRef,
    messages: messagesState.current,
    setMessages,
    rowToMessages,
    isInflightStatus: isInflight,
    onInitialResume: onResume,
  });
  return { result, getMessages: () => messagesState.current, bodyRef };
}

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('useChatPagination — initial fetch', () => {
  it('打 sort=desc&limit=5 載最新 5 筆', async () => {
    apiFetchMock.mockResolvedValue({
      items: [makeRow(5), makeRow(4), makeRow(3), makeRow(2), makeRow(1)],
      hasMore: true,
    });
    renderHook(() => useHarness({ activeTripId: 'trip-A' }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    const url = apiFetchMock.mock.calls[0][0];
    expect(url).toMatch(/tripId=trip-A/);
    expect(url).toMatch(/limit=5/);
    expect(url).toMatch(/sort=desc/);
  });

  it('回應 reverse 成時間軸 asc 顯示', async () => {
    apiFetchMock.mockResolvedValue({
      items: [makeRow(5), makeRow(4), makeRow(3), makeRow(2), makeRow(1)],
      hasMore: false,
    });
    const { result } = renderHook(() => useHarness({ activeTripId: 'trip-A' }));
    await waitFor(() => expect(result.current.getMessages().length).toBeGreaterThan(0));
    // rowToMessages 給 1 row 兩個 bubble (user + assistant), id1 在前 id5 在後
    const ids = result.current.getMessages().map((m) => m.id);
    expect(ids).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]); // baseId = id*2: 1→[2,3], 2→[4,5], ..., 5→[10,11]
  });

  it('hasMoreOlder 從 server hasMore 設定', async () => {
    apiFetchMock.mockResolvedValue({ items: [makeRow(1)], hasMore: true });
    const { result } = renderHook(() => useHarness({ activeTripId: 'trip-A' }));
    await waitFor(() => expect(result.current.result.hasMoreOlder).toBe(true));
  });

  it('inflight row → onInitialResume callback 回 row.id', async () => {
    const onResume = vi.fn();
    apiFetchMock.mockResolvedValue({
      items: [makeRow(1, { status: 'processing', reply: null })],
      hasMore: false,
    });
    renderHook(() =>
      useHarness({
        activeTripId: 'trip-A',
        isInflight: (r) => r.status === 'open' || r.status === 'processing',
        onResume,
      }),
    );
    await waitFor(() => expect(onResume).toHaveBeenCalledWith(1));
  });

  it('fetch 失敗 → loadError 設值', async () => {
    apiFetchMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useHarness({ activeTripId: 'trip-A' }));
    await waitFor(() => expect(result.current.result.loadError?.message).toBe('network down'));
  });
});

describe('useChatPagination — trip switch', () => {
  it('切換 trip 重置 messages + cursor + hasMoreOlder', async () => {
    apiFetchMock.mockResolvedValueOnce({ items: [makeRow(1)], hasMore: true });
    apiFetchMock.mockResolvedValueOnce({ items: [makeRow(99)], hasMore: false });
    const { result, rerender } = renderHook(
      ({ activeTripId }) => useHarness({ activeTripId }),
      { initialProps: { activeTripId: 'trip-A' as string | null } },
    );
    await waitFor(() => expect(result.current.getMessages().length).toBeGreaterThan(0));
    expect(result.current.result.hasMoreOlder).toBe(true);

    rerender({ activeTripId: 'trip-B' });
    // 切換瞬間清空,然後重 fetch
    await waitFor(() => {
      const ids = result.current.getMessages().map((m) => m.id);
      // trip-B fetch 只有 row id=99 → bubble id 198, 199
      return expect(ids).toEqual([198, 199]);
    });
    expect(result.current.result.hasMoreOlder).toBe(false);
  });
});

describe('useChatPagination — loadOlder', () => {
  it('happy path: prepend 訊息 + cursor 前移', async () => {
    apiFetchMock.mockResolvedValueOnce({
      items: [makeRow(5), makeRow(4), makeRow(3)],
      hasMore: true,
    });
    apiFetchMock.mockResolvedValueOnce({
      items: [makeRow(2), makeRow(1)],
      hasMore: false,
    });
    const { result } = renderHook(() => useHarness({ activeTripId: 'trip-A' }));
    await waitFor(() => expect(result.current.getMessages().length).toBe(6));
    await act(async () => {
      await result.current.result.loadOlder();
    });
    // 頭加上兩個 row 的 4 個 bubble (id 1→[2,3], id 2→[4,5])
    const firstIds = result.current.getMessages().slice(0, 4).map((m) => m.id);
    expect(firstIds).toEqual([2, 3, 4, 5]);
    expect(result.current.result.hasMoreOlder).toBe(false);
  });

  it('回 items=[] 即使 hasMore=true 也 flip hasMoreOlder=false (防無限 loop)', async () => {
    apiFetchMock.mockResolvedValueOnce({ items: [makeRow(1)], hasMore: true });
    apiFetchMock.mockResolvedValueOnce({ items: [], hasMore: true });
    const { result } = renderHook(() => useHarness({ activeTripId: 'trip-A' }));
    await waitFor(() => expect(result.current.result.hasMoreOlder).toBe(true));
    await act(async () => {
      await result.current.result.loadOlder();
    });
    expect(result.current.result.hasMoreOlder).toBe(false);
  });

  it('並發呼叫 loadOlder 只觸發一次 fetch (loadingOlderRef gate)', async () => {
    let resolveSecond: (value: unknown) => void = () => {};
    apiFetchMock.mockResolvedValueOnce({ items: [makeRow(1)], hasMore: true });
    apiFetchMock.mockReturnValueOnce(new Promise((r) => { resolveSecond = r; }));
    const { result } = renderHook(() => useHarness({ activeTripId: 'trip-A' }));
    await waitFor(() => expect(result.current.result.hasMoreOlder).toBe(true));
    // 同 tick 連續呼叫兩次 — 第二次應被 ref gate 擋掉
    await act(async () => {
      const a = result.current.result.loadOlder();
      const b = result.current.result.loadOlder();
      // 解開 first fetch
      resolveSecond({ items: [], hasMore: false });
      await a;
      await b;
    });
    // 1 次 initial fetch + 1 次 loadOlder = 2 (不是 3)
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it('Trip 切換中途回應 → race guard 擋,新 trip messages 不污染', async () => {
    let resolveOlderFromA: (v: unknown) => void = () => {};
    apiFetchMock.mockResolvedValueOnce({ items: [makeRow(1)], hasMore: true });
    apiFetchMock.mockReturnValueOnce(new Promise((r) => { resolveOlderFromA = r; }));
    apiFetchMock.mockResolvedValueOnce({ items: [makeRow(99)], hasMore: false });
    const { result, rerender } = renderHook(
      ({ activeTripId }) => useHarness({ activeTripId }),
      { initialProps: { activeTripId: 'trip-A' as string | null } },
    );
    await waitFor(() => expect(result.current.result.hasMoreOlder).toBe(true));
    // 啟 loadOlder 但不 resolve
    let loadOlderPromise: Promise<void> | null = null;
    await act(async () => {
      loadOlderPromise = result.current.result.loadOlder();
    });
    // 切到 trip-B (initial fetch from trip-B 開始)
    rerender({ activeTripId: 'trip-B' });
    await waitFor(() => {
      const ids = result.current.getMessages().map((m) => m.id);
      return expect(ids).toEqual([198, 199]);
    });
    // 解開原 trip-A 的 loadOlder fetch — 應該被 activeTripIdRef guard 擋下不 prepend
    await act(async () => {
      resolveOlderFromA({ items: [makeRow(0)], hasMore: false });
      await loadOlderPromise;
    });
    // trip-B 的 messages 沒被 trip-A 的 row 污染
    const ids = result.current.getMessages().map((m) => m.id);
    expect(ids).toEqual([198, 199]);
  });

  it('loadError 設值後 retryLoadOlder 清 error 並重試', async () => {
    apiFetchMock.mockResolvedValueOnce({ items: [makeRow(1)], hasMore: true });
    apiFetchMock.mockRejectedValueOnce(new Error('401 unauthorized'));
    apiFetchMock.mockResolvedValueOnce({ items: [makeRow(0)], hasMore: false });
    const { result } = renderHook(() => useHarness({ activeTripId: 'trip-A' }));
    await waitFor(() => expect(result.current.result.hasMoreOlder).toBe(true));
    await act(async () => {
      await result.current.result.loadOlder();
    });
    expect(result.current.result.loadError?.message).toBe('401 unauthorized');
    await act(async () => {
      result.current.result.retryLoadOlder();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.result.loadError).toBeNull();
  });
});
