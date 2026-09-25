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
import { useTripDays } from '../contexts/TripDaysContext';
import { dayNumFromId } from '../lib/entryAction';
import { getAutoRecomputeStatus, requestTravelRecompute } from '../lib/travelRecompute';
import type { TimelineEntryData } from '../components/trip/TimelineEvent';
import { retainSegmentScope } from '../lib/segmentScope';

export interface TripSegment {
  id: number;
  tripId: string;
  fromEntryId: number;
  toEntryId: number;
  mode: 'driving' | 'walking' | 'transit';
  /** v2.55.45 交通方式細分（monorail/bus/metro/train/hsr/自由文字/null）。driving/walking 恆 null。 */
  submode: string | null;
  min: number | null;
  distanceM: number | null;
  source: string | null;
  computedAt: number | null;
  updatedAt: number | null;
  /** v2.55.46: 1 = 同一地點/免交通（收合此段）；null = 正常交通段。 */
  noTravel: number | null;
}

interface SegmentTimeline {
  dayId?: number | null;
  entries: TimelineEntryData[];
  optimistic: boolean;
}

export function useTripSegments(tripId: string | null | undefined, timeline?: SegmentTimeline) {
  // v2.31.x N+1 fix: 若 TripPage 已 provide TripSegmentsContext，直接共用，
  // 不再重新 fetch（5 個 TimelineRail / day → 1 個 fetch）。EditEntryPage 等
  // 獨立頁面 context 為 null → 走原本 fetch path。
  const fromCtx = useContext(TripSegmentsContext);
  const scope = useMemo(() => ({ tripId }), [tripId]);
  const [readScope, setReadScope] = useState(scope);

  const [segments, setSegments] = useState<TripSegment[]>([]);
  const [loading, setLoading] = useState(false);
  // 2026-07-06 self-healing：首次 fetch settle 前 segments=[] 不代表「真的沒
  // segment」。TimelineRail 自動補算必須等 ready，否則初次 render 空 map 會
  // 誤判全天缺 pair → 白燒一輪 Google recompute。
  const [ready, setReady] = useState(false);
  const [canRecompute, setCanRecompute] = useState(false);

  useEffect(() => {
    if (fromCtx) return; // 由 provider 負責 fetch + lifecycle
    setReadScope(scope);
    setSegments([]);
    setReady(false);
    setCanRecompute(false);
    if (!tripId) {
      return;
    }
    const releaseScope = retainSegmentScope(tripId);
    // tripId 切換 → 舊 map 不能拿來判斷新 trip 的缺 pair，先降 ready
    let cancelled = false;
    let inFlight = false;
    let refreshPending = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchSegments = async () => {
      if (inFlight) return;
      inFlight = true;
      refreshPending = false;
      setLoading(true);
      try {
        const data = await apiFetch<TripSegment[]>(`/trips/${encodeURIComponent(tripId)}/segments`);
        if (cancelled || refreshPending) return;
        setSegments(Array.isArray(data) ? data : []);
        // ready 只在「成功」set：fetch 失敗的空 map ≠ 真的沒 segment，
        // 不能餵給 self-healing 當缺 pair 證據（transient read 失敗不該
        // 引發 write-side recompute — codex review P2）。
        setReady(true);
        setCanRecompute(true);
      } catch {
        if (cancelled) return;
        // 留 empty — caller graceful degrade
      } finally {
        inFlight = false;
        if (!cancelled) {
          if (refreshPending && !debounceTimer) void fetchSegments();
          else setLoading(false);
        }
      }
    };

    void fetchSegments();

    // drag-reorder / batch save 等 flow 會在 < 500ms 內 dispatch 多次 entry-updated /
    // segment-updated；debounce 合併連發成單一 refetch 避免 N+1 segments 呼叫。
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tripId?: string } | null;
      if (detail?.tripId && detail.tripId !== tripId) return;
      refreshPending = true;
      setCanRecompute(false);
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
      releaseScope();
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener(EVENT.segmentUpdated, handler);
      window.removeEventListener(EVENT.entryUpdated, handler);
    };
  }, [tripId, fromCtx, scope]);

  const segmentMap = useMemo(() => {
    const m = new Map<string, TripSegment>();
    for (const s of segments) {
      m.set(`${s.fromEntryId}-${s.toEntryId}`, s);
    }
    return m;
  }, [segments]);

  const read = fromCtx ?? (readScope === scope
    ? { segments, segmentMap, loading, ready, canRecompute }
    : { segments: [], segmentMap: new Map<string, TripSegment>(), loading: !!tripId, ready: false, canRecompute: false });
  const days = useTripDays();
  const dayNum = dayNumFromId(days, timeline?.dayId);
  const entries = timeline?.entries;
  const optimistic = timeline?.optimistic;
  const confirmed = read.canRecompute ?? read.ready;

  // Only a successful read and committed adjacency are evidence for a gap.
  // Unknown days must never broaden automatic work to the whole trip.
  useEffect(() => {
    if (!tripId || !confirmed || optimistic || dayNum == null || !entries) return;
    const gaps: string[] = [];
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1];
      const curr = entries[i];
      if (prev?.id == null || curr?.id == null) continue;
      if (prev.masterLat == null || prev.masterLng == null
        || curr.masterLat == null || curr.masterLng == null) continue;
      const segment = read.segmentMap.get(`${prev.id}-${curr.id}`);
      if (!segment || segment.computedAt == null) gaps.push(`${prev.id}-${curr.id}`);
    }
    if (gaps.length) void requestTravelRecompute(tripId, dayNum, { auto: true, signature: gaps.join(',') });
  }, [tripId, confirmed, read.segmentMap, optimistic, dayNum, entries]);

  const [, updateStatus] = useState(0);
  useEffect(() => {
    if (!tripId) return;
    const failed = (event: Event) => {
      const detail = (event as CustomEvent<{ tripId?: string }>).detail;
      if (!detail?.tripId || detail.tripId === tripId) updateStatus((n) => n + 1);
    };
    window.addEventListener(EVENT.segmentRecomputeFailed, failed);
    return () => window.removeEventListener(EVENT.segmentRecomputeFailed, failed);
  }, [tripId]);

  return { ...read, recomputeStalled: !!tripId && getAutoRecomputeStatus(tripId, dayNum) !== 'active' };
}
