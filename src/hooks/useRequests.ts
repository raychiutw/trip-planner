import { useState, useRef, useCallback, useEffect } from 'react';
import { apiFetchRaw } from '../lib/apiClient';

export interface RawRequest {
  id: number;
  trip_id: string;
  mode: string;
  message: string;
  submitted_by: string | null;
  reply: string | null;
  status: 'open' | 'processing' | 'completed' | 'failed';
  processed_by: 'api' | 'job' | null;
  created_at: string;
  updated_at: string | null;
}

interface UseRequestsResult {
  requests: RawRequest[];
  requestsLoading: boolean;
  requestsError: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadRequests: (tripId: string) => Promise<void>;
  loadMore: () => Promise<void>;
  appendRequest: (req: RawRequest) => void;
  updateRequestStatus: (id: number, status: RawRequest['status'], processedBy?: RawRequest['processed_by']) => void;
  refreshRequest: (id: number) => Promise<void>;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Manages the paginated request list for a given trip.
 * Accepts the current tripId via the returned `loadRequests` function.
 * Exposes a sentinelRef for infinite-scroll via IntersectionObserver.
 */
export function useRequests(currentTripIdRef: React.RefObject<string | null>): UseRequestsResult {
  const [requests, setRequests] = useState<RawRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestsRef = useRef(requests);
  requestsRef.current = requests;

  const abortRef = useRef<AbortController | null>(null);

  /* ----- Load requests for a trip (first page) ----- */
  const loadRequests = useCallback(async (tripId: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRequestsLoading(true);
    setRequestsError(null);
    setRequests([]);
    setHasMore(false);

    try {
      // 初始載入用 DESC（拿最新 N 筆），收到後 reverse 成 ASC 顯示（聊天式：最新在底部）
      const res = await apiFetchRaw('/requests?tripId=' + encodeURIComponent(tripId) + '&limit=10', {
        signal: controller.signal,
      });
      if (res.status === 401) throw new Error('認證失敗，請重新整理頁面');
      if (res.status === 403) throw new Error('你沒有此行程的權限');
      if (!res.ok) throw new Error('載入失敗');
      const data = (await res.json()) as { items: RawRequest[]; hasMore: boolean };
      if (currentTripIdRef.current === tripId) {
        setRequests(data.items.reverse());
        setHasMore(data.hasMore);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      if (currentTripIdRef.current === tripId) {
        setRequestsError(err instanceof Error ? err.message : '載入失敗');
      }
    } finally {
      setRequestsLoading(false);
    }
  }, [currentTripIdRef]);

  /* ----- Load more requests (older, prepend to top) ----- */
  const loadMore = useCallback(async () => {
    const tripId = currentTripIdRef.current;
    if (!tripId || loadingMore || !hasMore) return;

    // requests[0] 是目前最舊的，用 before cursor 載入更舊的
    const oldest = requestsRef.current[0];
    if (!oldest) return;

    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        tripId,
        limit: '10',
        before: oldest.created_at,
        beforeId: String(oldest.id),
      });
      const res = await apiFetchRaw('/requests?' + params.toString());
      if (!res.ok) throw new Error('載入失敗');
      const data = (await res.json()) as { items: RawRequest[]; hasMore: boolean };
      if (currentTripIdRef.current === tripId) {
        // DESC 回來的 reverse 成 ASC，prepend 到頂部
        setRequests(prev => [...data.items.reverse(), ...prev]);
        setHasMore(data.hasMore);
      }
    } catch {
      // 靜默失敗 — 使用者可再次滾動觸發
    } finally {
      setLoadingMore(false);
    }
  }, [currentTripIdRef, loadingMore, hasMore]);

  /* ----- Infinite scroll: sentinel at TOP for loading older messages (ASC mode) ----- */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) loadMore(); },
      { rootMargin: '200px 0px 0px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  /* ----- Optimistic append (after submit) ----- */
  const appendRequest = useCallback((req: RawRequest) => {
    setRequests(prev => [...prev, req]);
  }, []);

  /* ----- In-place status update (from SSE) ----- */
  const updateRequestStatus = useCallback((
    id: number,
    status: RawRequest['status'],
    processedBy?: RawRequest['processed_by'],
  ) => {
    setRequests(prev => prev.map(r =>
      r.id === id ? { ...r, status, ...(processedBy !== undefined ? { processed_by: processedBy } : {}) } : r
    ));
  }, []);

  /* ----- Refresh single request (fetch reply after completed) ----- */
  const refreshRequest = useCallback(async (id: number) => {
    try {
      const res = await apiFetchRaw(`/requests/${id}`);
      if (!res.ok) return;
      const updated = (await res.json()) as RawRequest;
      setRequests(prev => prev.map(r => r.id === id ? updated : r));
    } catch {}
  }, []);

  return {
    requests,
    requestsLoading,
    requestsError,
    hasMore,
    loadingMore,
    loadRequests,
    loadMore,
    appendRequest,
    updateRequestStatus,
    refreshRequest,
    sentinelRef,
  };
}
