import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { apiFetch } from '../lib/apiClient';
import { mergeConversation, rowToMessages, type ChatMessage, type RawRequestRow } from '../lib/conversation';
import { useChatPagination } from './useChatPagination';
import { useRequestSSE } from './useRequestSSE';

/** The conversation owns request interpretation for both the root tab and trip sheet. */
export function useConversation(activeTripId: string | null, bodyRef: RefObject<HTMLDivElement | null>) {
  const scopeRef = useRef({ tripId: activeTripId, active: true, sending: false });
  if (scopeRef.current.tripId !== activeTripId) scopeRef.current = { tripId: activeTripId, active: true, sending: false };
  const scope = scopeRef.current;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inflightId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index--) {
      const id = messages[index]?.pendingRequestId;
      if (id && id > 0) return id;
    }
    return null;
  }, [messages]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [sending, setSending] = useState(false);
  const lastLocalId = useRef(0);
  useEffect(() => {
    scope.active = true;
    setStopping(false); setSending(false);
    return () => { scope.active = false; };
  }, [scope]);
  const pagination = useChatPagination<RawRequestRow, ChatMessage>({
    activeTripId, bodyRef, messages, setMessages, rowToMessages, mergeMessages: mergeConversation,
    setHistoryLoading,
  });
  const { status, error: sseError, errorReason, elapsedMs } = useRequestSSE(inflightId);

  const applyTerminal = useCallback((row: RawRequestRow) => {
    if (scopeRef.current !== scope || !scope.active || row.tripId !== scope.tripId) return;
    if (row.status !== 'completed' && row.status !== 'failed') return;
    const assistant = rowToMessages(row).find((message) => message.role === 'assistant')!;
    setMessages((previous) => previous.map((message) =>
      message.role === 'assistant' && (message.pendingRequestId === row.id || message.requestId === row.id)
        ? { ...assistant, id: message.id, pendingRequestId: null }
        : message));
  }, [scope]);

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
      if (scopeRef.current !== scope || !scope.active) return;
      applyTerminal(await apiFetch<RawRequestRow>(`/requests/${id}`));
    } catch {
      if (scopeRef.current !== scope || !scope.active) return;
      setMessages((previous) => previous.map((message) => message.pendingRequestId === id
        ? { ...message, requestId: id, text: '已在這裡停止等待，但伺服器沒有確認 —— AI 可能仍在處理。', pendingRequestId: null, terminated: false, failed: true, stopUnconfirmed: true }
        : message));
    } finally { if (scopeRef.current === scope && scope.active) setStopping(false); }
  }, [inflightId, stopping, applyTerminal, scope]);

  const sendMessage = useCallback(async (text: string, actor?: { email?: string; displayName?: string | null } | null) => {
    if (!activeTripId || scopeRef.current !== scope || !scope.active || scope.sending || inflightId) return;
    scope.sending = true; setSending(true);
    const now = Math.max(Date.now(), lastLocalId.current + 2);
    lastLocalId.current = now;
    setMessages((previous) => [...previous,
      { id: now, role: 'user', text, createdAt: new Date(now).toISOString(), submittedBy: actor?.email ?? null, submittedByDisplayName: actor?.displayName ?? null },
      { id: now + 1, role: 'assistant', text: '思考中…', pendingRequestId: -1 },
    ]);
    try {
      const row = await apiFetch<{ id: number }>('/requests', {
        method: 'POST', body: JSON.stringify({ tripId: activeTripId, message: text }),
      });
      if (scopeRef.current !== scope || !scope.active) return;
      setMessages((previous) => mergeConversation([], previous.map((message) =>
        message.id === now || message.id === now + 1
          ? { ...message, requestId: row.id, ...(message.role === 'assistant' ? { pendingRequestId: row.id } : {}) }
          : message)));
    } catch (error) {
      if (scopeRef.current !== scope || !scope.active) return;
      setMessages((previous) => previous.map((message) => message.id === now + 1
        ? { ...message, text: `送出失敗：${error instanceof Error ? error.message : '網路錯誤'}`, pendingRequestId: null, failed: true }
        : message));
    } finally {
      scope.sending = false;
      if (scopeRef.current === scope && scope.active) setSending(false);
    }
  }, [activeTripId, scope, inflightId]);

  return { messages, sendMessage, inflightId, busy: sending || !!inflightId, historyLoading, ...pagination,
    sseError, errorReason, elapsedMs, stopping, stopWaiting };
}
