import { useState, useEffect, useRef } from 'react';

type RequestStatus = 'open' | 'processing' | 'completed' | 'failed';
type ProcessedBy = 'api' | 'job' | null;
type ErrorReason = 'auth_expired' | 'network' | 'sse_failed' | null;

/**
 * Narrow untrusted backend / SSE JSON to canonical RequestStatus / ProcessedBy.
 * v2.33.39 round 4 security audit: avoid blindly casting `as RequestStatus`
 * — a regressed backend / compromised proxy could send arbitrary strings the
 * UI then branches on (settle() never fires → UI hangs).
 */
const VALID_STATUSES = new Set<RequestStatus>(['open', 'processing', 'completed', 'failed']);
function narrowStatus(s: unknown): RequestStatus | null {
  return typeof s === 'string' && VALID_STATUSES.has(s as RequestStatus) ? (s as RequestStatus) : null;
}
function narrowProcessedBy(p: unknown): ProcessedBy {
  return p === 'api' || p === 'job' ? p : null;
}
function clampErrorMessage(msg: unknown): string {
  return typeof msg === 'string' ? msg.replace(/[\r\n]+/g, ' ').slice(0, 500) : '未知錯誤';
}

interface UseRequestSSEResult {
  status: RequestStatus | null;
  processedBy: ProcessedBy;
  error: Error | null;
  errorReason: ErrorReason;
  isConnected: boolean;
  elapsedMs: number;
}

const SAFETY_NET_POLL_INTERVAL_MS = 30_000;
// v2.33.31 (simplify PR-4): tick at minute boundary, not every second.
// UI consumers (ChatPage:944-946) only read elapsedMs in 1-minute buckets
// (`>= 3 * 60 * 1000` threshold + `Math.floor(elapsedMs / 60_000)` display),
// so per-second setState forced ChatPage to re-render up to 900× per AI-health-check
// wait (5-15 min). Tick once per minute via setInterval keeps the value fresh
// enough for the 3-minute threshold without burning React renders.
const ELAPSED_TICK_MS = 60_000;

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
    let disposed = false;
    const controllers = new Set<AbortController>();
    // 新 api：ticket 連線＋typed client。動態載入：ticket 連線的執行期程式不放進首屏 bundle。
    const ticketMode = import('../lib/sse/ticketMode').then((m) => ({ ...m.createTicketMode(), openTicketStream: m.openTicketStream }));
    let closeTicketStream: (() => void) | null = null;
    setStatus(null); setProcessedBy(null); setError(null); setErrorReason(null); setElapsedMs(0);
    const startTime = Date.now();

    const cleanupAll = () => {
      disposed = true;
      for (const controller of controllers) controller.abort();
      closeTicketStream?.();
      closeTicketStream = null;
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
      if (disposed || terminalRef.current) return;
      terminalRef.current = true;
      setStatus(s);
      setProcessedBy(pb);
      cleanupAll();
    };

    // ── Elapsed timer (1-minute tick, per ELAPSED_TICK_MS comment) ──
    tickTimerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, ELAPSED_TICK_MS);

    // ── Safety-net polling (every 30s, always on) ───────────────────
    // v2.33.129 G9: 加 AbortController 10s timeout —之前 pollOnce fetch 沒
    // timeout，CF Worker stuck 時 promise 永不 resolve，下一輪 setInterval
    // 仍 fire 但全部卡，user 看到 spinner 永遠不動。10s 是 conservative
    // (95% CF p99 < 1s)，超 10s 直接視為 unresponsive 進下輪 retry。
    const POLL_FETCH_TIMEOUT_MS = 10_000;
    const pollOnce = async (): Promise<void> => {
      if (disposed || terminalRef.current) return;
      const ctrl = new AbortController();
      controllers.add(ctrl);
      const abortTimer = setTimeout(() => ctrl.abort(), POLL_FETCH_TIMEOUT_MS);
      try {
        // 新 api（Bearer/DPoP）
        const { api } = await ticketMode;
        const r = await api.get('/api/requests/{id}', { path: { id: String(requestId) }, signal: ctrl.signal });
        const res = { status: r.status, ok: r.ok, json: async () => (r.ok ? r.data : r.error) };
        if (disposed) return;
        if (res.status === 401) {
          setErrorReason('auth_expired');
          setError(new Error('登入已過期，請重新整理頁面'));
          cleanupAll();
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as { status?: unknown; processedBy?: unknown };
        if (disposed) return;
        const narrowedStatus = narrowStatus(data.status);
        const narrowedProcessedBy = narrowProcessedBy(data.processedBy);
        if (!narrowedStatus) return; // unknown status — ignore, next poll retries
        if (!terminalRef.current) {
          setStatus(narrowedStatus);
          setProcessedBy(narrowedProcessedBy);
        }
        if (narrowedStatus === 'completed' || narrowedStatus === 'failed') {
          settle(narrowedStatus, narrowedProcessedBy);
        }
      } catch {
        // network error / abort timeout — next tick retries
      } finally {
        clearTimeout(abortTimer);
        controllers.delete(ctrl);
      }
    };
    // v2.33.39 round 4: 立即 fire 一次，原本只 schedule 30s 後第一次 poll，
    // AI 健檢可能 7s 內 SSE silent-fail 就完成（user 等 30s 才看到結果）。
    void pollOnce();
    pollTimerRef.current = setInterval(() => { void pollOnce(); }, SAFETY_NET_POLL_INTERVAL_MS);

    // ── SSE (fast path) ─────────────────────────────────────────────
    const onSseOpen = () => {
      if (disposed) return;
      setIsConnected(true);
      setError((prev) => (prev?.message === 'SSE 連線失敗' ? null : prev));
      setErrorReason((prev) => (prev === 'sse_failed' ? null : prev));
    };

    const onSseMessage = (event: { data: string }) => {
      if (disposed) return;
      try {
        const data = JSON.parse(event.data) as Record<string, unknown>;
        if (data.error) {
          // v2.33.39 round 4: clamp untrusted SSE error string to 500 chars +
          // strip newlines。defense against multi-MB blast or future render
          // path 透過 markdown 觸發 stored-DOM-XSS。
          setError(new Error(clampErrorMessage(data.error)));
          return;
        }
        const narrowedStatus = narrowStatus(data.status);
        if (narrowedStatus && !terminalRef.current) {
          const narrowedProcessedBy = narrowProcessedBy(data.processedBy);
          setStatus(narrowedStatus);
          setProcessedBy(narrowedProcessedBy);
          if (narrowedStatus === 'completed' || narrowedStatus === 'failed') {
            settle(narrowedStatus, narrowedProcessedBy);
          }
        }
      } catch {
        // malformed SSE data — ignore; polling will catch up
      }
    };

    // 一次性 ticket：重連一律自己重新換票（原生自動重連會重送用過的 ticket → 401）
    ticketMode.then((mode) => {
      if (disposed) return;
      closeTicketStream = mode.openTicketStream({
        requestId,
        apiBase: mode.apiBase,
        api: mode.api,
        auth: mode.auth,
        createEventSource: (url) => new EventSource(url),
        onOpen: onSseOpen,
        onMessage: onSseMessage,
        onFatal: (reason) => {
          if (disposed) return;
          setIsConnected(false);
          if (reason === 'auth_required') {
            setErrorReason('auth_expired');
            setError(new Error('登入已過期，請重新整理頁面'));
            cleanupAll();
          } else {
            setErrorReason('sse_failed'); // polling 兜底繼續跑
          }
        },
      });
    }, () => {
      if (!disposed) setErrorReason('sse_failed');
    });

    return cleanupAll;
  }, [requestId]);

  return { status, processedBy, error, errorReason, isConnected, elapsedMs };
}
