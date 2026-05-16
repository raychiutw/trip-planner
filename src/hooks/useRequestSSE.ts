import { useState, useEffect, useRef } from 'react';
import { apiFetchRaw } from '../lib/apiClient';

type RequestStatus = 'open' | 'processing' | 'completed' | 'failed';
type ProcessedBy = 'api' | 'job' | null;
type ErrorReason = 'auth_expired' | 'network' | 'sse_failed' | null;

interface UseRequestSSEResult {
  status: RequestStatus | null;
  processedBy: ProcessedBy;
  error: Error | null;
  errorReason: ErrorReason;
  isConnected: boolean;
  elapsedMs: number;
}

const SAFETY_NET_POLL_INTERVAL_MS = 30_000;
const ELAPSED_TICK_MS = 1_000;

/**
 * Subscribe to a trip_request's status with SSE + always-on polling safety net.
 *
 * v2.31.6: polling 永遠跑（每 30s），SSE 只是 latency optimization。第一個看到
 * terminal 的 source 贏，cleanup 雙方。原本只有 SSE-error→polling 切換的設計，
 * 在 EventSource auto-reconnect 不觸 onerror 時會 silently 卡死（user 等不到 reply）。
 */
export function useRequestSSE(requestId: number | null): UseRequestSSEResult {
  const [status, setStatus] = useState<RequestStatus | null>(null);
  const [processedBy, setProcessedBy] = useState<ProcessedBy>(null);
  const [error, setError] = useState<Error | null>(null);
  const [errorReason, setErrorReason] = useState<ErrorReason>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const esRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const terminalRef = useRef(false);

  useEffect(() => {
    if (!requestId) {
      // reset
      setStatus(null);
      setProcessedBy(null);
      setError(null);
      setErrorReason(null);
      setIsConnected(false);
      setElapsedMs(0);
      terminalRef.current = false;
      return;
    }

    terminalRef.current = false;
    const startTime = Date.now();

    const cleanupAll = () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (tickTimerRef.current) {
        clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }
      setIsConnected(false);
    };

    const settle = (s: RequestStatus, pb: ProcessedBy) => {
      if (terminalRef.current) return;
      terminalRef.current = true;
      setStatus(s);
      setProcessedBy(pb);
      cleanupAll();
    };

    // ── Elapsed timer (1s tick) ─────────────────────────────────────
    tickTimerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, ELAPSED_TICK_MS);

    // ── Safety-net polling (every 30s, always on) ───────────────────
    const pollOnce = async (): Promise<void> => {
      if (terminalRef.current) return;
      try {
        const res = await apiFetchRaw(`/requests/${requestId}`);
        if (res.status === 401) {
          setErrorReason('auth_expired');
          setError(new Error('登入已過期，請重新整理頁面'));
          cleanupAll();
          return;
        }
        if (!res.ok) return;
        const data = await res.json() as { status: RequestStatus; processedBy: string | null };
        if (!terminalRef.current) {
          setStatus(data.status);
          setProcessedBy((data.processedBy as ProcessedBy) ?? null);
        }
        if (data.status === 'completed' || data.status === 'failed') {
          settle(data.status, (data.processedBy as ProcessedBy) ?? null);
        }
      } catch {
        // network error — next tick retries
      }
    };
    pollTimerRef.current = setInterval(() => { void pollOnce(); }, SAFETY_NET_POLL_INTERVAL_MS);

    // ── SSE (fast path) ─────────────────────────────────────────────
    const baseUrl = import.meta.env.DEV ? 'http://localhost:8788' : '';
    const url = `${baseUrl}/api/requests/${requestId}/events`;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setError((prev) => (prev?.message === 'SSE 連線失敗' ? null : prev));
      setErrorReason((prev) => (prev === 'sse_failed' ? null : prev));
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          status?: RequestStatus;
          processedBy?: string | null;
          error?: string;
        };
        if (data.error) {
          setError(new Error(data.error));
          return;
        }
        if (data.status && !terminalRef.current) {
          setStatus(data.status);
          setProcessedBy((data.processedBy as ProcessedBy) ?? null);
          if (data.status === 'completed' || data.status === 'failed') {
            settle(data.status, (data.processedBy as ProcessedBy) ?? null);
          }
        }
      } catch {
        // malformed SSE data — ignore; polling will catch up
      }
    };

    es.onerror = () => {
      // 不 close — 讓 EventSource auto-reconnect。polling 兜底，不 silent fail。
      setIsConnected(false);
      setErrorReason('sse_failed');
    };

    return cleanupAll;
  }, [requestId]);

  return { status, processedBy, error, errorReason, isConnected, elapsedMs };
}
