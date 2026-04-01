import { useState, useRef, useCallback, useEffect } from 'react';
import { apiFetchRaw } from './useApi';

export interface RawRequest {
  id: number;
  trip_id: string;
  mode: string;
  message: string;
  submitted_by: string | null;
  reply: string | null;
  status: 'open' | 'received' | 'processing' | 'completed';
  created_at: string;
}

interface UseRequestsResult {
  requests: RawRequest[];
  requestsLoading: boolean;
  requestsError: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadRequests: (tripId: string) => Promise<void>;
  loadMore: () => Promise<void>;
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
      const res = await apiFetchRaw('/requests?tripId=' + encodeURIComponent(tripId) + '&limit=10', {
        signal: controller.signal,
      });
      if (res.status === 401) throw new Error('認證失敗，請重新整理頁面');
      if (res.status === 403) throw new Error('你沒有此行程的權限');
      if (!res.ok) throw new Error('載入失敗');
      const data = (await res.json()) as { items: RawRequest[]; hasMore: boolean };
      if (currentTripIdRef.current === tripId) {
        setRequests(data.items);
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

  /* ----- Load more requests (older, append) ----- */
  const loadMore = useCallback(async () => {
    const tripId = currentTripIdRef.current;
    if (!tripId || loadingMore || !hasMore) return;

    const last = requestsRef.current[requestsRef.current.length - 1];
    if (!last) return;

    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        tripId,
        limit: '10',
        before: last.created_at,
        beforeId: String(last.id),
      });
      const res = await apiFetchRaw('/requests?' + params.toString());
      if (!res.ok) throw new Error('載入失敗');
      const data = (await res.json()) as { items: RawRequest[]; hasMore: boolean };
      if (currentTripIdRef.current === tripId) {
        setRequests(prev => [...prev, ...data.items]);
        setHasMore(data.hasMore);
      }
    } catch {
      // 靜默失敗 — 使用者可再次滾動觸發
    } finally {
      setLoadingMore(false);
    }
  }, [currentTripIdRef, loadingMore, hasMore]);

  /* ----- Infinite scroll: sentinel at BOTTOM for loading older messages ----- */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return {
    requests,
    requestsLoading,
    requestsError,
    hasMore,
    loadingMore,
    loadRequests,
    loadMore,
    sentinelRef,
  };
}
