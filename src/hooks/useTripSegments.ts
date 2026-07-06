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
import { useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { TripSegmentsContext } from '../contexts/TripSegmentsContext';
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
  // v2.31.x N+1 fix: 若 TripPage 已 provide TripSegmentsContext，直接共用，
  // 不再重新 fetch（5 個 TimelineRail / day → 1 個 fetch）。EditEntryPage 等
  // 獨立頁面 context 為 null → 走原本 fetch path。
  const fromCtx = useContext(TripSegmentsContext);

  const [segments, setSegments] = useState<TripSegment[]>([]);
  const [loading, setLoading] = useState(false);
  // 2026-07-06 self-healing：首次 fetch settle 前 segments=[] 不代表「真的沒
  // segment」。TimelineRail 自動補算必須等 ready，否則初次 render 空 map 會
  // 誤判全天缺 pair → 白燒一輪 Google recompute。
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (fromCtx) return; // 由 provider 負責 fetch + lifecycle
    if (!tripId) {
      setSegments([]);
      return;
    }
    // tripId 切換 → 舊 map 不能拿來判斷新 trip 的缺 pair，先降 ready
    setReady(false);
    let cancelled = false;
    let inFlight = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchSegments = async () => {
      if (inFlight) return;
      inFlight = true;
      setLoading(true);
      try {
        const data = await apiFetch<TripSegment[]>(`/trips/${encodeURIComponent(tripId)}/segments`);
        if (cancelled) return;
        setSegments(Array.isArray(data) ? data : []);
        // ready 只在「成功」set：fetch 失敗的空 map ≠ 真的沒 segment，
        // 不能餵給 self-healing 當缺 pair 證據（transient read 失敗不該
        // 引發 write-side recompute — codex review P2）。
        setReady(true);
      } catch {
        if (cancelled) return;
        // 留 empty — caller graceful degrade
      } finally {
        inFlight = false;
        if (!cancelled) setLoading(false);
      }
    };

    void fetchSegments();

    // drag-reorder / batch save 等 flow 會在 < 500ms 內 dispatch 多次 entry-updated /
    // segment-updated；debounce 合併連發成單一 refetch 避免 N+1 segments 呼叫。
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tripId?: string } | null;
      if (detail?.tripId && detail.tripId !== tripId) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void fetchSegments();
      }, 200);
    };

    window.addEventListener(EVENT.segmentUpdated, handler);
    window.addEventListener(EVENT.entryUpdated, handler);

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener(EVENT.segmentUpdated, handler);
      window.removeEventListener(EVENT.entryUpdated, handler);
    };
  }, [tripId, fromCtx]);

  const segmentMap = useMemo(() => {
    const m = new Map<string, TripSegment>();
    for (const s of segments) {
      m.set(`${s.fromEntryId}-${s.toEntryId}`, s);
    }
    return m;
  }, [segments]);

  if (fromCtx) {
    return { segments: fromCtx.segments, segmentMap: fromCtx.segmentMap, loading: fromCtx.loading, ready: fromCtx.ready };
  }
  return { segments, segmentMap, loading, ready };
}
