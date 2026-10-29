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
 * Empty/null tripId → no fetch；失敗或更新中的 map 不作自動補算依據。
 * 可選的 auto 參數讓時間軸以已確認的 segment read 判斷真實缺口。
 */
import { useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { TripSegmentsContext } from '../contexts/TripSegmentsContext';
import { EVENT } from '../lib/events';
import { getAutoRecomputeStatus, requestTravelRecompute } from '../lib/travelRecompute';

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

type SegmentPoint = { id?: number | null; masterLat?: number | null; masterLng?: number | null };
type AutoRecompute = { dayNum: number | null; entries: readonly SegmentPoint[]; suspended: boolean };
const EMPTY_SEGMENTS: TripSegment[] = [];

export function useTripSegments(tripId: string | null | undefined, auto?: AutoRecompute) {
  // v2.31.x N+1 fix: 若 TripPage 已 provide TripSegmentsContext，直接共用，
  // 不再重新 fetch（5 個 TimelineRail / day → 1 個 fetch）。EditEntryPage 等
  // 獨立頁面 context 為 null → 走原本 fetch path。
  const fromCtx = useContext(TripSegmentsContext);

  const [segments, setSegments] = useState<TripSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedTripId, setLoadedTripId] = useState<string | null>(null);
  // 2026-07-06 self-healing：首次 fetch settle 前 segments=[] 不代表「真的沒
  // segment」。TimelineRail 自動補算必須等 ready，否則初次 render 空 map 會
  // 誤判全天缺 pair → 白燒一輪 Google recompute。
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (fromCtx) return; // 由 provider 負責 fetch + lifecycle
    if (!tripId) {
      setSegments([]);
      setReady(false);
      setLoadedTripId(null);
      return;
    }
    // tripId 切換 → 舊 map 不能拿來判斷新 trip 的缺 pair，先降 ready
    setReady(false);
    let cancelled = false;
    let inFlight = false;
    let refreshPending = false;
    let generation = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchSegments = async () => {
      if (inFlight) { refreshPending = true; return; }
      inFlight = true;
      const requestGeneration = generation;
      setLoading(true);
      try {
        const data = await apiFetch<TripSegment[]>(`/trips/${encodeURIComponent(tripId)}/segments`);
        if (cancelled || requestGeneration !== generation) return;
        setSegments(Array.isArray(data) ? data : []);
        setLoadedTripId(tripId);
        // ready 只在「成功」set：fetch 失敗的空 map ≠ 真的沒 segment，
        // 不能餵給 self-healing 當缺 pair 證據（transient read 失敗不該
        // 引發 write-side recompute — codex review P2）。
        setReady(true);
      } catch {
        if (cancelled) return;
        // 保留既有顯示；ready=false 阻止失敗的讀取觸發補算。
      } finally {
        inFlight = false;
        if (!cancelled) {
          if (refreshPending) {
            refreshPending = false;
            void fetchSegments();
          } else {
            setLoading(false);
          }
        }
      }
    };

    void fetchSegments();

    // drag-reorder / batch save 等 flow 會在 < 500ms 內 dispatch 多次 entry-updated /
    // segment-updated；debounce 合併連發成單一 refetch 避免 N+1 segments 呼叫。
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tripId?: string } | null;
      if (detail?.tripId && detail.tripId !== tripId) return;
      generation++;
      setReady(false);
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

  const currentSegments = loadedTripId === tripId ? segments : EMPTY_SEGMENTS;
  const segmentMap = useMemo(() => {
    const m = new Map<string, TripSegment>();
    for (const s of currentSegments) {
      m.set(`${s.fromEntryId}-${s.toEntryId}`, s);
    }
    return m;
  }, [currentSegments]);

  const activeMap = fromCtx?.segmentMap ?? segmentMap;
  const activeReady = fromCtx?.ready ?? (loadedTripId === tripId && ready);
  const autoEntries = auto?.entries;
  const autoDayNum = auto?.dayNum;
  const autoSuspended = auto?.suspended;
  const autoEnabled = autoEntries != null;

  useEffect(() => {
    if (!tripId || !activeReady || autoSuspended || autoDayNum == null || !autoEntries) return;
    const gaps: string[] = [];
    for (let i = 1; i < autoEntries.length; i++) {
      const prev = autoEntries[i - 1]!;
      const curr = autoEntries[i]!;
      if (prev.id == null || curr.id == null || prev.masterLat == null || prev.masterLng == null
        || curr.masterLat == null || curr.masterLng == null) continue;
      const segment = activeMap.get(`${prev.id}-${curr.id}`);
      if (!segment || segment.computedAt == null) gaps.push(`${prev.id}-${curr.id}`);
    }
    if (gaps.length > 0) void requestTravelRecompute(tripId, autoDayNum, { auto: true, signature: gaps.join(',') });
  }, [tripId, activeReady, autoSuspended, autoDayNum, autoEntries, activeMap]);

  const [, bumpRecomputeStatus] = useState(0);
  useEffect(() => {
    if (!tripId || !autoEnabled) return;
    const onFailed = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tripId?: string } | null;
      if (detail?.tripId && detail.tripId !== tripId) return;
      bumpRecomputeStatus((n) => n + 1);
    };
    window.addEventListener(EVENT.segmentRecomputeFailed, onFailed);
    return () => window.removeEventListener(EVENT.segmentRecomputeFailed, onFailed);
  }, [tripId, autoEnabled]);
  const autoStatus = tripId ? getAutoRecomputeStatus(tripId, autoDayNum) : 'active';

  if (fromCtx) {
    return { segments: fromCtx.segments, segmentMap: activeMap, loading: fromCtx.loading, ready: activeReady, autoStatus };
  }
  return { segments: currentSegments, segmentMap: activeMap, loading, ready: activeReady, autoStatus };
}
