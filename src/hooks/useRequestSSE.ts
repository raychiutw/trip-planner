import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetchRaw } from '../lib/apiClient';

type RequestStatus = 'open' | 'processing' | 'completed' | 'failed';
type ProcessedBy = 'api' | 'job' | null;

interface UseRequestSSEResult {
  status: RequestStatus | null;
  processedBy: ProcessedBy;
  error: Error | null;
  isConnected: boolean;
}

/**
 * SSE hook for real-time request status updates.
 * Falls back to 10s polling if SSE connection fails.
 */
export function useRequestSSE(requestId: number | null): UseRequestSSEResult {
  const [status, setStatus] = useState<RequestStatus | null>(null);
  const [processedBy, setProcessedBy] = useState<ProcessedBy>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseFailedRef = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;

  const cleanup = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Fallback polling
  const startPolling = useCallback((id: number) => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await apiFetchRaw(`/requests/${id}`);
        if (!res.ok) return;
        const data = await res.json() as { status: RequestStatus; processedBy: string | null };
        setStatus(data.status);
        setProcessedBy((data.processedBy as ProcessedBy) ?? null);
        if (data.status === 'completed' || data.status === 'failed') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch {
        // network error — keep polling, next tick will retry
      }
    }, 10_000);
  }, []);

  useEffect(() => {
    if (!requestId) {
      cleanup();
      setStatus(null);
      setProcessedBy(null);
      setError(null);
      sseFailedRef.current = false;
      return;
    }

    // Terminal check via ref (avoids status in deps causing reconnects)
    if (statusRef.current === 'completed' || statusRef.current === 'failed') {
      cleanup();
      return;
    }

    if (sseFailedRef.current) {
      startPolling(requestId);
      return;
    }

    const baseUrl = import.meta.env.DEV ? 'http://localhost:8788' : '';
    const url = `${baseUrl}/api/requests/${requestId}/events`;

    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setError(null);
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
        if (data.status) {
          setStatus(data.status);
          setProcessedBy((data.processedBy as ProcessedBy) ?? null);
          if (data.status === 'completed' || data.status === 'failed') {
            es.close();
            esRef.current = null;
            setIsConnected(false);
          }
        }
      } catch {
        // malformed SSE data — ignore
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      sseFailedRef.current = true;
      es.close();
      esRef.current = null;
      setError(new Error('SSE 連線失敗，切換為輪詢模式'));
      startPolling(requestId);
    };

    return cleanup;
  }, [requestId, cleanup, startPolling]); // status removed from deps

  return { status, processedBy, error, isConnected };
}
