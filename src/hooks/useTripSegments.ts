/**
 * useTripSegments — v2.24.0 Phase γ.1
 *
 * Fetch GET /api/trips/:id/segments + 監聽 `tp-segment-updated` event re-fetch。
 *
 * Returns `segmentMap` 索引為 `${fromEntryId}-${toEntryId}` → segment row，方便
 * TimelineRail 在 entry pair render 時 O(1) 查找。
 *
 * 也 listen `tp-entry-updated`：entry 增刪 / sort_order 變動會觸發 recompute-travel
 * → segments 改變 → 需 re-fetch。
 *
 * Empty/null tripId → no fetch，回 empty map。Failure → 不 retry，silently 留 empty
 * map（caller 端 graceful degrade — TravelPill 無 segment props 變 v2.23 唯讀渲染）。
 */
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { EVENT } from '../lib/events';

export interface TripSegment {
  id: number;
  tripId: string;
  fromEntryId: number;
  toEntryId: number;
  mode: 'driving' | 'walking' | 'transit';
  min: number | null;
  distanceM: number | null;
  source: string | null;
  computedAt: number | null;
  updatedAt: number | null;
}

export function useTripSegments(tripId: string | null | undefined) {
  const [segments, setSegments] = useState<TripSegment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tripId) {
      setSegments([]);
      return;
    }
    let cancelled = false;
    let inFlight = false;

    const fetchSegments = async () => {
      if (inFlight) return;
      inFlight = true;
      setLoading(true);
      try {
        const data = await apiFetch<TripSegment[]>(`/trips/${encodeURIComponent(tripId)}/segments`);
        if (cancelled) return;
        setSegments(Array.isArray(data) ? data : []);
      } catch {
        if (cancelled) return;
        // 留 empty — caller graceful degrade
      } finally {
        inFlight = false;
        if (!cancelled) setLoading(false);
      }
    };

    void fetchSegments();

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tripId?: string } | null;
      // 沒帶 tripId → 一律 re-fetch（保守）；帶且不符 → skip
      if (detail?.tripId && detail.tripId !== tripId) return;
      void fetchSegments();
    };

    window.addEventListener(EVENT.segmentUpdated, handler);
    window.addEventListener(EVENT.entryUpdated, handler);

    return () => {
      cancelled = true;
      window.removeEventListener(EVENT.segmentUpdated, handler);
      window.removeEventListener(EVENT.entryUpdated, handler);
    };
  }, [tripId]);

  const segmentMap = useMemo(() => {
    const m = new Map<string, TripSegment>();
    for (const s of segments) {
      m.set(`${s.fromEntryId}-${s.toEntryId}`, s);
    }
    return m;
  }, [segments]);

  return { segments, segmentMap, loading };
}
