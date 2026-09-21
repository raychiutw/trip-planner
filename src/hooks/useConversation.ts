import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { apiFetch } from '../lib/apiClient';
import { rowToMessages, type ChatMessage, type RawRequestRow } from '../lib/conversation';
import { useChatPagination } from './useChatPagination';
import { useRequestSSE } from './useRequestSSE';

/** The conversation owns request interpretation for both the root tab and trip sheet. */
export function useConversation(activeTripId: string | null, bodyRef: RefObject<HTMLDivElement | null>) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inflightId, setInflightId] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [stopping, setStopping] = useState(false);
  const pagination = useChatPagination<RawRequestRow, ChatMessage>({
    activeTripId, bodyRef, messages, setMessages, rowToMessages,
    isInflightStatus: (row) => row.status === 'open' || row.status === 'processing',
    onInitialResume: setInflightId, setHistoryLoading,
  });
  const { status, error: sseError, errorReason, elapsedMs } = useRequestSSE(inflightId);

  const applyTerminal = useCallback((row: RawRequestRow) => {
    if (row.status !== 'completed' && row.status !== 'failed') return;
    const assistant = rowToMessages(row).find((message) => message.role === 'assistant')!;
    setMessages((previous) => previous.map((message) =>
      message.role === 'assistant' && (message.pendingRequestId === row.id || message.requestId === row.id)
        ? { ...assistant, id: message.id, pendingRequestId: null }
        : message));
    setInflightId((current) => current === row.id ? null : current);
  }, []);

  useEffect(() => {
    if (!inflightId || (status !== 'completed' && status !== 'failed')) return;
    let cancelled = false;
    void apiFetch<RawRequestRow>(`/requests/${inflightId}`).then((row) => {
      if (!cancelled) applyTerminal(row);
    }).catch(() => { /* A read failure is not a failed AI operation. */ });
    return () => { cancelled = true; };
  }, [status, inflightId, applyTerminal]);

  // Terminal status closes SSE, but a worker may still submit a late reply.
  // Refresh visible requests on return from another tab and while waiting for it.
  const visibleRef = useRef({ messages, status });
  visibleRef.current = { messages, status };
  useEffect(() => {
    if (!activeTripId) return;
    let cancelled = false;
    let refreshing = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (refreshing || cancelled) return;
      refreshing = true;
      const visible = visibleRef.current;
      const ids = new Set(visible.messages.filter((message) => message.role === 'assistant'
        && (message.failed || message.terminated || visible.status === 'completed' || visible.status === 'failed'))
        .map((message) => message.requestId ?? message.pendingRequestId).filter((id): id is number => !!id && id > 0));
      try {
        await Promise.all([...ids].map(async (id) => {
          try {
            const row = await apiFetch<RawRequestRow>(`/requests/${id}`, {
              signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
            });
            if (!cancelled && row.tripId === activeTripId) applyTerminal(row);
          } catch { /* Retry on the next refresh; retain the known result. */ }
        }));
      } finally { refreshing = false; }
    };
    const onFocus = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible') onFocus(); };
    const timer = setInterval(onFocus, 30_000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true; controller.abort(); clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [activeTripId, applyTerminal]);

  const stopWaiting = useCallback(async () => {
    if (!inflightId || stopping) return;
    const id = inflightId;
    setStopping(true);
    try {
      await apiFetch(`/requests/${id}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'failed', terminalReason: 'cancelled' }),
      });
      applyTerminal(await apiFetch<RawRequestRow>(`/requests/${id}`));
    } catch {
      setMessages((previous) => previous.map((message) => message.pendingRequestId === id
        ? { ...message, requestId: id, text: '已在這裡停止等待，但伺服器沒有確認 —— AI 可能仍在處理。', pendingRequestId: null, terminated: false, failed: true }
        : message));
      setInflightId((current) => current === id ? null : current);
    } finally { setStopping(false); }
  }, [inflightId, stopping, applyTerminal]);

  return { messages, setMessages, inflightId, setInflightId, historyLoading, ...pagination,
    sseError, errorReason, elapsedMs, stopping, stopWaiting };
}
