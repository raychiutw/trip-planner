import { Suspense, useState, useEffect, useMemo, useCallback, useRef, useImperativeHandle, forwardRef, type ReactNode } from 'react';
import { lazyWithRetry } from '../lib/lazyWithRetry';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineToast } from '../hooks/useOfflineToast';
import { useDragDrop } from '../hooks/useDragDrop';
import { TP_DRAG_ACCESSIBILITY } from '../lib/drag-announcements';
import { buildCrossDayMoves, railItemsFirstCollision } from '../lib/crossDayMove';
import { requestTravelRecompute } from '../lib/travelRecompute';
import { apiFetch, apiFetchRaw } from '../lib/apiClient';
import { EVENT } from '../lib/events';
import { mapRow } from '../lib/mapRow';
import { lsGet, lsSet, lsRemove, lsRenewAll, LS_KEY_TRIP_PREF } from '../lib/localStorage';
import { useActiveTrip } from '../contexts/ActiveTripContext';
import { resolveTripId } from '../lib/resolveTripId';
import { useTrip } from '../hooks/useTrip';
import { useDarkMode } from '../hooks/useDarkMode';
import { usePrintMode } from '../hooks/usePrintMode';
import { TRIP_TIMEZONE, getLocalToday } from '../lib/constants';
import { downloadTripJson } from '../lib/tripExport';
import { renderTripPrintPdf } from '../components/print/renderTripPrintPdf';
import { showToast } from '../lib/toastBus';
import { computeActiveDayIndex, getStableViewportH, computeInitialHash } from '../lib/scrollSpy';
import { useScrollRestoreOnBack } from '../hooks/useScrollRestoreOnBack';
import { TripIdContext } from '../contexts/TripIdContext';
import { TripDaysContext } from '../contexts/TripDaysContext';
import { TripSegmentsContext } from '../contexts/TripSegmentsContext';
import { useTripSegments } from '../hooks/useTripSegments';
import type { DayOption } from '../lib/entryAction';
import DayNav from '../components/trip/DayNav';
import DaySection from '../components/trip/DaySection';
import { extractPinsFromDay } from '../hooks/useMapData';
/* F005: TripSheet 延遲載（內部 lazy load TripMapRail 以避免 Leaflet 進首頁 bundle）*/
const TripSheet = lazyWithRetry(() => import('../components/trip/TripSheet'));
// Migration 0045 (2026-05-02): trips.footer dropped. Footer.tsx component
// deleted in same commit. FooterArt (decorative SVG, ThemeArt module, unrelated)
// stays.
import CollabSheet from '../components/trip/CollabSheet';
import AlertPanel from '../components/shared/AlertPanel';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import { useCurrentUser } from '../hooks/useCurrentUser';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import InfoSheet from '../components/trip/InfoSheet';
import ToastContainer from '../components/shared/Toast';
import { FooterArt } from '../components/trip/ThemeArt';
import DaySkeleton from '../components/trip/DaySkeleton';
import type { TripListItem } from '../types/trip';

function isTripListItem(item: Record<string, unknown>): item is Record<string, unknown> & TripListItem {
  return typeof item.tripId === 'string'
    && typeof item.name === 'string'
    && typeof item.owner === 'string'
    && typeof item.published === 'number';
}

import '../../css/tokens.css';

/* ===== Module-level constants (#14: hoist inline styles) ===== */

const UNPUBLISHED_CLASS = 'text-muted mt-2';

// 2026-05-03 modal-to-fullpage migration: deriveAddStopRegion 移除。
// 原本用 trip 名 / countries regex 推斷 default region，現在 AddStopPage
// 自己處理 region selector (用 trip data fetch + 地區清單)，TripPage 不再
// 需要轉換 — 直接 navigate 過去，AddStopPage 處理 default region。

/* ===== Scoped styles — only rules Tailwind/tokens.css cannot express ===== */
const SCOPED_STYLES = `
/* Day-content enter animations */
@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.day-content-enter {
  animation: fadeSlideIn var(--transition-duration-normal) var(--transition-timing-function-apple) both;
}
.day-content-loaded {
  animation: fadeIn 300ms var(--transition-timing-function-apple) both;
}
.trip-content { min-width: 0; }

/* Compact-hidden TitleBar actions — 桌機(>=761px) 顯示「建議 / 共編 / 下載」
 * inline,手機塞進 OverflowMenu 避免標題列擁擠。 */
@media (max-width: 760px) {
  .tp-titlebar-action[data-compact-hidden="true"] { display: none; }
}

/* Print mode */
.print-mode .print-exit-btn { display: block; }
.print-mode .page-layout { padding-right: 0 !important; }
.print-mode #tripContent section { background: var(--color-background) !important; }
.print-mode .day-header { background: var(--color-background); position: relative !important; flex-wrap: wrap; padding: 8px 12px; }
.print-mode .container { max-width: 210mm; margin: 0 auto; box-shadow: var(--shadow-lg); }
@media print {
  .print-exit-btn { display: none !important; }
}
`;

/* ===== Static early-return views (#13: hoist to module level) ===== */

const UNPUBLISHED_VIEW = (
  <div className="flex min-h-dvh">
    <div className="flex-1 min-w-0 max-w-full mx-auto">
      <div id="tripContent">
        <div className="text-center p-10 text-foreground">
          <p className="mb-4 text-title2">此行程已下架</p>
          <p className={UNPUBLISHED_CLASS}>2 秒後跳轉至設定頁…</p>
        </div>
      </div>
    </div>
  </div>
);

const LOADING_VIEW = (
  <div className="flex min-h-dvh">
    <div className="flex-1 min-w-0 max-w-full mx-auto">
      <div id="tripContent">
        <div className="px-padding-h">
          <DaySkeleton />
          <DaySkeleton />
        </div>
      </div>
    </div>
  </div>
);

/* ===== URL helpers ===== */

// Legacy query-string compat (React Router handles path-based routing)
function getQueryTrip(): string | null {
  return new URLSearchParams(window.location.search).get('trip');
}

/* ===== Scroll helpers ===== */

/**
 * Find the actual scrolling ancestor of `el`. AppShell uses a constrained
 * `.app-shell-main { overflow-y: auto }` as the scroll container, so the
 * window doesn't scroll. Fall back to document if no ancestor scrolls.
 */
function findScrollContainer(el: HTMLElement): HTMLElement | Window {
  let parent: HTMLElement | null = el.parentElement;
  while (parent) {
    const cs = getComputedStyle(parent);
    const overflowY = cs.overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return window;
}

function scrollToDay(dayNum: number): void {
  const header = document.getElementById('day' + dayNum);
  if (!header) return;
  // scroll-margin-top on the header (set in the align effect below) handles
  // the day-strip sticky offset, so we just use scrollIntoView here.
  header.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ===== Resolve state machine ===== */

type ResolveState =
  | { status: 'loading' }
  | { status: 'unpublished' }
  | { status: 'resolved'; tripId: string };

/* ===== Component ===== */

export interface TripPageProps {
  /** Override tripId from URL params. Used when TripPage is embedded inside
   * another page (e.g., TripsListPage's right sheet on desktop, or main slot
   * when /trips?selected=X is set on mobile). */
  tripId?: string;
  /** When true, render only the inner trip content (timeline + day nav) —
   * skip the AppShell wrapper, sidebar, sheet, bottomNav. The hosting page
   * provides those. */
  noShell?: boolean;
}

/* PR-SS/UU 2026-04-27：embedded mode 用 ref 從外部 trigger 各 actions。
 * TripsListPage 的 embedded topbar ⋯ 漢堡選單透過此 handle 呼叫。 */
export interface TripPageHandle {
  openSheet: (key: string) => void;
  triggerDownload: (format: 'pdf' | 'json') => void;
  togglePrint: () => void;
  /** Section 3 (terracotta-add-stop-modal) E2E follow-up：embedded mode 也能
   *  trigger AddStopModal，TripsListPage 的 embedded TitleBar 開放此 entry。 */
  openAddStop: () => void;
}

function TripPageInner(
  { tripId: propTripId, noShell = false }: TripPageProps,
  ref: React.Ref<TripPageHandle>,
) {
  const { tripId: urlTripId } = useParams<{ tripId: string }>();
  // Prefer prop tripId (embedded mode) over URL (route mode).
  const effectiveUrlTripId = propTripId ?? urlTripId;
  const navigate = useNavigate();
  const { user: currentUser } = useCurrentUser();
  const [resolveState, setResolveState] = useState<ResolveState>({ status: 'loading' });
  const [resolveKey, setResolveKey] = useState(0);   /* Fix 5: re-trigger resolve */
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  // Section 3 (terracotta-add-stop-modal)：trip-level「+ 加入景點」 modal state，
  // 帶當前 active day 進去；user 完成 commit 後 dispatch tp-entry-updated 觸發
  // refetch（既有 listener 處理）。
  // 2026-05-03 modal-to-fullpage migration: AddStopModal 由 /trip/:id/add-stop?day=N
  // page 取代。openAddStop() handle 改 navigate (取代原本 setAddStopOpen)。
  // navigate 在 TripPageInner scope 可從 useNavigate() 取，但我們已經用 router
  // hooks 在這檔，直接 wire navigate 到 openAddStop。
  // showNavTitle removed along with old sticky-nav inline title
  const manualScrollTs = useRef(0);
  const initialScrollDone = useRef(false);
  const scrollDayRef = useRef(0);

  /* --- Scroll restore when returning from StopDetailPage --- */
  useScrollRestoreOnBack();

  /* --- Online status + offline/reconnect toasts --- */
  const isOnline = useOnlineStatus();
  useOfflineToast(isOnline);
  // Stable ref so the effect below can call refetchCurrentDay without re-running
  // when refetchCurrentDay identity changes (it is declared after useTrip below).
  const refetchCurrentDayRef = useRef<(() => void) | null>(null);
  // Same pattern for refetchDay — listener 讀 event.detail.dayNum 時
  // 走 refetchDay(targetDay) 而非 refetchCurrentDay (該 day 可能 ≠ currentDay)。
  const refetchDayRef = useRef<((dayNum: number) => void) | null>(null);

  // Refresh stale data when connection is restored
  const prevIsOnlineRef = useRef(isOnline);
  useEffect(() => {
    if (!prevIsOnlineRef.current && isOnline) {
      refetchCurrentDayRef.current?.();
    }
    prevIsOnlineRef.current = isOnline;
  }, [isOnline]);

  // V3 inline expansion (PR2): TimelineRail dispatches `tp-entry-updated`
  // on successful note PATCH. AddStopModal / future inline editors 也 dispatch
  // 這個 event with `detail: { tripId, dayNum }`。讀 detail.dayNum 走
  // refetchDay(targetDay) — handle add 到 currentDay 以外的 day case
  // (e.g. day strip 選 Day 1 但 modal 加到 Day 3, 時間線同時顯示所有 day,
  //  Day 3 cache 仍需 invalidate 才會看到新 entry)。
  // 沒帶 dayNum (legacy event source) → fallback refetchCurrentDay。
  useEffect(() => {
    function onEntryUpdated(e: Event) {
      const detail = (e as CustomEvent).detail as { dayNum?: number } | null;
      const targetDay = detail?.dayNum;
      if (typeof targetDay === 'number' && targetDay > 0) {
        refetchDayRef.current?.(targetDay);
      } else {
        refetchCurrentDayRef.current?.();
      }
    }
    window.addEventListener(EVENT.entryUpdated, onEntryUpdated);
    return () => window.removeEventListener(EVENT.entryUpdated, onEntryUpdated);
  }, []);

  /* --- Dark mode + Print mode (#2: coordinated via shared state) --- */
  const { isDark, setIsDark } = useDarkMode();

  const { isPrintMode, togglePrint } = usePrintMode({ isDark, setIsDark });

  /**
   * v2.31.46 #143：portal target lookup for embedded mode sticky map sheet。
   * 從 host AppShell（TripsListPage）拿 `<aside id="trip-sheet-portal">` DOM
   * 後 createPortal 把 sheetContent 推過去。
   *
   * v2.31.54 嘗試改 per-render lookup 觸發 e2e 大批 timeout（render phase
   * `getElementById` 跑在 DOM commit 之前，拿不到 portal target → 第一次
   * render no portal，e2e wait visible timeout）— reverted 回原 useState +
   * useEffect 兩階段 pattern：第一次 render = null，effect commit 後 setState
   * 觸發 re-render 拿 node 後 portal。 */
  const [sheetPortalNode, setSheetPortalNode] = useState<Element | null>(null);
  useEffect(() => {
    if (!noShell) return;
    setSheetPortalNode(document.getElementById('trip-sheet-portal'));
  }, [noShell]);

  /* --- lsRenewAll once per session (#9) --- */
  useEffect(() => {
    if (!sessionStorage.getItem('lsRenewed')) {
      lsRenewAll();
      sessionStorage.setItem('lsRenewed', '1');
    }
  }, []);

  /* --- Resolve trip ID from URL / localStorage / default (#6: cancelled guard) --- */
  /* Fix 5: resolveKey in deps allows re-triggering without full page reload */
  useEffect(() => {
    let cancelled = false;
    // Priority 1: React Router params (/trip/:tripId)
    // Priority 2: legacy query string ?trip=xxx
    // Priority 3: localStorage
    let tripId: string | null = (effectiveUrlTripId && /^[\w-]+$/.test(effectiveUrlTripId)) ? effectiveUrlTripId : null;
    if (!tripId) tripId = getQueryTrip();
    // 明確導航目標 = 來自 URL param / prop(?selected=) / 舊 ?trip=（非 localStorage pref）。
    // 決定「比對不到 /api/trips 時是否信任此 tripId」（見 resolveTripId / v2.43.x fix）。
    const isExplicitTarget = !!tripId && /^[\w-]+$/.test(tripId);
    if (!tripId || !/^[\w-]+$/.test(tripId)) {
      tripId = lsGet<string>(LS_KEY_TRIP_PREF);
    }

    // Reset scroll tracking for new trip
    initialScrollDone.current = false;

    apiFetch<Record<string, unknown>[]>('/trips')
      .then((raw) => {
        if (cancelled) return;
        const trips: TripListItem[] = raw.map(r => mapRow(r)).filter(isTripListItem);

        // Migration 0045 dropped trips.is_default. Fallback改用 user 第一個
        // published=1 的 trip — TripsListPage 列表已是 published=1 ordered by
        // name ASC，取第一筆即可（PR plan Q5 / commit 18）。
        const defaultTrip = trips.find((t) => t.published === 1);

        // 比對 tripId 是否存在於已發布行程中
        const match = tripId ? trips.find((t) => t.tripId === tripId) : null;

        if (match && match.published === 0) {
          lsRemove(LS_KEY_TRIP_PREF);
          setResolveState({ status: 'unpublished' });
          setTimeout(() => { navigate(defaultTrip ? `/trip/${defaultTrip.tripId}` : '/', { replace: true }); }, 2000);
          return;
        }

        // v2.43.x fix：明確導航目標（URL/prop/?trip=）即使不在 permission-filtered
        // /api/trips（排除使用者自己的私人 clone, published=0）也信任它，不再 silently
        // fallback 到第一個 published trip（QA 2026-06-02 prod bug：從列表點自己的私人
        // clone 卻看到「別的 trip 的行程」）。存取權由下方 useTrip(activeTripId) 的實際
        // fetch 驗證（403/404 → error state，而非 silently 顯示另一個 trip）。
        const resolvedId = resolveTripId(tripId, isExplicitTarget, trips);

        if (!resolvedId) {
          setResolveState({ status: 'unpublished' });
          return;
        }

        lsSet(LS_KEY_TRIP_PREF, resolvedId);
        setResolveState({ status: 'resolved', tripId: resolvedId });
      })
      .catch(() => {
        if (cancelled) return;
        // API 失敗時仍嘗試用現有 tripId（離線容錯）
        if (tripId) {
          lsSet(LS_KEY_TRIP_PREF, tripId);
          setResolveState({ status: 'resolved', tripId });
        }
      });

    return () => { cancelled = true; };
  }, [resolveKey, effectiveUrlTripId, navigate]);

  /* --- Derive active tripId for the hook --- */
  const activeTripId = resolveState.status === 'resolved' ? resolveState.tripId : null;

  /* Section 5 (E4)：將 resolved trip id 寫入 ActiveTripContext，提供給
   * /chat /map /explore 等 global route 之預設 active trip。 */
  const { setActiveTrip } = useActiveTrip();
  useEffect(() => {
    if (activeTripId) setActiveTrip(activeTripId);
  }, [activeTripId, setActiveTrip]);

  const { trip, days, currentDayNum, switchDay, refetchCurrentDay, refetchDay, allDays, loading, error } =
    useTrip(activeTripId);

  // v2.31.x N+1 fix: 集中 fetch segments，children TimelineRail 透過 context 共用。
  // 不傳 provider 時 hook 退回自己 fetch（EditEntryPage 等獨立頁面適用）。
  const segmentsHookResult = useTripSegments(activeTripId);
  const tripSegmentsContextValue = useMemo(() => ({
    segments: segmentsHookResult.segments,
    segmentMap: segmentsHookResult.segmentMap,
    loading: segmentsHookResult.loading,
    ready: segmentsHookResult.ready,
  }), [segmentsHookResult.segments, segmentsHookResult.segmentMap, segmentsHookResult.loading, segmentsHookResult.ready]);

  // Keep ref in sync so the online-status effect can call it without a stale closure
  refetchCurrentDayRef.current = refetchCurrentDay;
  refetchDayRef.current = refetchDay;

  /** Direct download by format — JSON via lib, PDF via the data-driven print doc. */
  const handleDownloadFormat = useCallback(async (format: 'pdf' | 'json') => {
    if (!activeTripId) return;
    try {
      if (format === 'json') await downloadTripJson({ tripId: activeTripId, trip });
      else await renderTripPrintPdf({ tripId: activeTripId, trip });
    } catch (err) {
      console.error(`[handleDownloadFormat] ${format} 失敗:`, err);
      showToast('下載失敗，請稍後再試', 'error', 3000);
    }
  }, [activeTripId, trip]);

  /* --- Update document title --- */
  useEffect(() => {
    if (trip?.title) document.title = trip.title;
    if (trip?.description) {
      document.querySelector('meta[name="description"]')?.setAttribute('content', trip.description);
    }
    if (trip?.title) {
      document.querySelector('meta[property="og:title"]')?.setAttribute('content', trip.title);
    }
    // Migration 0045 dropped trips.og_description. SSR (functions/trip/[[path]].ts)
    // already derives og:description from `${countries} 行程` fallback — sufficient
    // SEO baseline. Client no longer overrides.
  }, [trip]);

  /* --- Sorted day nums --- */
  const dayNums = useMemo(
    () => days.map((d) => d.dayNum).sort((a, b) => a - b),
    [days],
  );

  /* --- Day summary map for O(1) lookup (#11) --- */
  const daySummaryMap = useMemo(() => {
    const map = new Map<number, (typeof days)[number]>();
    for (const d of days) map.set(d.dayNum, d);
    return map;
  }, [days]);

  /* --- v2.10 Wave 1: DayOption[] for ⎘/⇅ popover day picker.
   *      Built once per trip data change; provided via TripDaysContext. */
  const dayOptions: DayOption[] = useMemo(() => {
    return dayNums.map((n) => {
      const day = allDays[n];
      const summary = daySummaryMap.get(n);
      return {
        dayNum: n,
        dayId: day?.id ?? 0,
        label: summary?.date
          ? `${summary.date}${summary.dayOfWeek ? `（${summary.dayOfWeek}）` : ''}`
          : `Day ${n}`,
        stopCount: day?.timeline?.length ?? 0,
      };
    }).filter((d) => d.dayId > 0);
  }, [dayNums, allDays, daySummaryMap]);

  /* --- Auto-scroll dates --- */
  const autoScrollDates = useMemo(
    () => days.map((d) => d.date).filter((d): d is string => !!d).sort(),
    [days],
  );

  /* --- 2026-07-07 跨天拖拉：TripPage 統一 DndContext ---
   * 全部 DaySection 的 rails 共用一個 context（dndManaged rail 不自建），
   * dnd-kit 內建 autoScroll = 拖到視窗邊緣自動捲動（捲動流換天的核心體驗）。
   * 同日 reorder 由各 rail 的 useDndMonitor 自己接（active/over 同 day）；
   * 這裡只處理跨天 drop：batch PATCH（day_id + 目標日 sort_order 重排）→
   * 兩天顯式 recompute + 各 dispatch entryUpdated（帶 dayNum → refetchDay）。 */
  const { sensors: crossDaySensors } = useDragDrop({ includeTouch: true, pointerActivationDistance: 8, sortable: true });
  const handleCrossDayDragEnd = useCallback(async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || typeof active.id !== 'number' || !activeTripId) return;
    const activeDayId = (active.data.current as { dayId?: number | null } | undefined)?.dayId;
    const overData = over.data?.current as { dayId?: number | null; railContainer?: boolean } | undefined;
    const targetDayId = overData?.dayId;
    // 同日（rail monitor 處理）或 data 缺 → 不動
    if (activeDayId == null || targetDayId == null || activeDayId === targetDayId) return;
    const targetOpt = dayOptions.find((d) => d.dayId === targetDayId);
    const sourceOpt = dayOptions.find((d) => d.dayId === activeDayId);
    if (!targetOpt) return;
    const targetIds = (allDays[targetOpt.dayNum]?.timeline ?? [])
      .map((t) => (t as { id?: number | null }).id)
      .filter((id): id is number => typeof id === 'number');
    const overEntryId = overData?.railContainer ? null : (typeof over.id === 'number' ? over.id : null);
    const updates = buildCrossDayMoves(active.id, targetDayId, targetIds, overEntryId);
    try {
      const res = await apiFetchRaw(`/trips/${encodeURIComponent(activeTripId)}/entries/batch`, {
        method: 'PATCH',
        credentials: 'same-origin',
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) throw new Error(`batch ${res.status}`);
      void requestTravelRecompute(activeTripId, targetOpt.dayNum).catch(() => undefined);
      if (sourceOpt) void requestTravelRecompute(activeTripId, sourceOpt.dayNum).catch(() => undefined);
      // 兩天各發一次（detail.dayNum → refetchDay 精準 invalidate 該天 cache）
      window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: { tripId: activeTripId, dayNum: targetOpt.dayNum } }));
      if (sourceOpt) window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: { tripId: activeTripId, dayNum: sourceOpt.dayNum } }));
      showToast(`已移到 Day ${String(targetOpt.dayNum).padStart(2, '0')}`, 'success');
    } catch {
      showToast('跨天移動失敗，請稍後再試', 'error');
    }
  }, [activeTripId, dayOptions, allDays]);

  /* --- Pins for TripMapRail (hoisted out of JSX IIFE for AppShell sheet slot) --- */
  const mapRailData = useMemo(() => {
    type Pin = ReturnType<typeof extractPinsFromDay>['pins'][number];
    const pinsByDay = new Map<number, Pin[]>();
    const allPins: Pin[] = [];
    for (const n of dayNums) {
      const day = allDays[n];
      if (!day) continue;
      const { pins } = extractPinsFromDay(day);
      pinsByDay.set(n, pins);
      allPins.push(...pins);
    }
    return { allPins, pinsByDay };
  }, [dayNums, allDays]);

  /* --- Trip start/end scalars for HourlyWeather (T3) --- */
  const tripStart = autoScrollDates[0] ?? null;
  const tripEnd = autoScrollDates[autoScrollDates.length - 1] ?? null;

  /* --- Weather timezone derived from trip destination --- */
  const weatherTimezone = useMemo(() => {
    if (!activeTripId) return undefined;
    const prefix = activeTripId.split('-')[0] ?? '';
    return TRIP_TIMEZONE[prefix];
  }, [activeTripId]);

  /* --- Today's date (timezone-aware) — shared by DayNav and Timeline --- */
  const localToday = useMemo(() => getLocalToday(activeTripId), [activeTripId]);

  /* --- Today's day_num for DayNav today marker (timezone-aware) --- */
  const todayDayNum = useMemo(() => {
    const match = days.find((d) => d.date === localToday);
    return match?.dayNum;
  }, [days, localToday]);

  /* --- DayNav click: scroll to day section (#4) --- */
  const handleSwitchDay = useCallback(
    (dayNum: number) => {
      manualScrollTs.current = Date.now();
      switchDay(dayNum);
      scrollToDay(dayNum);
      history.replaceState(null, '', '#day' + dayNum);
    },
    [switchDay],
  );

  /* --- Auto-scroll to today or hash on initial load (#3, #5, #18) --- */
  useEffect(() => {
    if (loading || dayNums.length === 0 || initialScrollDone.current) return;
    initialScrollDone.current = true;

    // Reset browser scroll restoration to prevent stale position
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);

    // PR-Q 2026-04-26：?sheet=<key> URL param — 從 /trips card kebab 過來。
    // v2.17.17：v2.17.16/17 cleanup 後其餘 sheet keys 已移除，只剩 collab。
    // v2.18.0：collab 升格獨立頁面 /trip/:id/collab，?sheet=collab redirect
    // 過去（保 legacy URL 相容）。
    const sheetParam = new URLSearchParams(window.location.search).get('sheet');
    if (sheetParam === 'collab' && resolveState.status === 'resolved') {
      navigate(`/trip/${encodeURIComponent(resolveState.tripId)}/collab`, { replace: true });
    }

    // PR-R 2026-04-26：?focus=<entryId> URL param 優先級最高（從 /map 點 POI
    // 卡「跳到行程」過來，需要 scroll 到該 entry）。useScrollRestoreOnBack
    // 已處理 location.state.scrollAnchor，但 GlobalMapPage Link 同時放 query
    // 跟 state，兩條路任一條 work 都行。這裡 query 那條是 fallback —
    // 例如 user 直接貼 URL 沒有 history state。
    const focusParam = new URLSearchParams(window.location.search).get('focus');
    if (focusParam) {
      requestAnimationFrame(() => {
        const sel = `[data-scroll-anchor="entry-${CSS.escape(focusParam)}"]`;
        const el = document.querySelector<HTMLElement>(sel);
        if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' });
      });
      return;
    }

    // URL hash takes priority over auto-locate
    const hash = window.location.hash;
    const hashMatch = hash?.match(/^#day(\d+)$/);
    if (hashMatch) {
      const hashDay = parseInt(hashMatch[1] ?? '0', 10);
      if (dayNums.includes(hashDay)) {
        requestAnimationFrame(() => {
          switchDay(hashDay);
          scrollToDay(hashDay);
        });
        return;
      }
    }

    // 單天行程或頁面短於 viewport 時 onScroll 不會觸發，hash 永遠停在初始值。
    // 在初始 resolve 完同步推合法 hash 進 URL，避免分享連結時沒有日期錨點。
    const initialHash = computeInitialHash(dayNums, hash, localToday, autoScrollDates);
    if (initialHash && window.location.hash !== initialHash) {
      history.replaceState(null, '', initialHash);
    }

    // Auto-locate to today (timezone-aware)
    const idx = autoScrollDates.indexOf(localToday);
    const todayDayNum = idx >= 0 ? dayNums[idx] : undefined;
    // v2.33.46 round 7a: timer / rAF cleanup — 之前 nav away within 300ms 後
    // 還 fire scrollIntoView 到 stale node。雖目前無 [data-now] visible，但
    // unmount leak pattern 不該保留。
    let rafId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (todayDayNum !== undefined) {
      rafId = requestAnimationFrame(() => {
        switchDay(todayDayNum);
        scrollToDay(todayDayNum);
        timeoutId = setTimeout(() => {
          const nowEl = document.querySelector('[data-now]');
          if (nowEl) {
            nowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      });
    }
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
    // resolveState 是 discriminated union（tripId 只在 'resolved' variant），deps 不能
    // 取 .tripId（render 時可能是 loading variant → TS error）；依賴整個 resolveState 物件，
    // 變動由 initialScrollDone latch 擋住重跑。
  }, [loading, dayNums, autoScrollDates, switchDay, localToday, navigate, resolveState]);

  /* --- scrollMarginTop dynamic alignment (#7) --- */
  useEffect(() => {
    function align() {
      const nav = document.getElementById('stickyNav');
      if (!nav) return;
      const margin = (nav.offsetHeight + (parseFloat(getComputedStyle(nav).top) || 0) + 4) + 'px';
      document.querySelectorAll('.day-header').forEach((h) => {
        (h as HTMLElement).style.scrollMarginTop = margin;
      });
    }
    align();
    window.addEventListener('resize', align, { passive: true });
    return () => window.removeEventListener('resize', align);
  }, [loading]);

  /* --- Scroll tracking: update active pill + hash (#6).
   * AppShell makes `.app-shell-main` the scroll container (overflow-y: auto).
   * Window doesn't scroll, so listening on window misses every scroll event.
   * Attach the listener to the scroll container of any day header. */
  useEffect(() => {
    if (loading || dayNums.length === 0) return;
    if (isPrintMode) return;

    const firstHeader = document.getElementById('day' + dayNums[0]);
    if (!firstHeader) return;
    const scroller = findScrollContainer(firstHeader);

    function onScroll() {
      const nav = document.getElementById('stickyNav');
      const navH = nav ? nav.offsetHeight + (parseFloat(getComputedStyle(nav).top) || 0) : 0;
      const headerTops = dayNums.map((n) => {
        const h = document.getElementById('day' + n);
        return h ? h.getBoundingClientRect().top : null;
      });
      const current = computeActiveDayIndex(headerTops, navH, getStableViewportH());
      if (current >= 0) {
        const activeDayNum = dayNums[current] ?? -1;
        if (activeDayNum >= 0 && activeDayNum !== scrollDayRef.current) {
          scrollDayRef.current = activeDayNum;
          switchDay(activeDayNum);
        }
        if (Date.now() - manualScrollTs.current > 600) {
          const newHash = '#day' + activeDayNum;
          if (window.location.hash !== newHash) {
            history.replaceState(null, '', newHash);
          }
        }
      }
    }

    let ticking = false;
    function throttledScroll() {
      if (!ticking) {
        requestAnimationFrame(() => { onScroll(); ticking = false; });
        ticking = true;
      }
    }

    scroller.addEventListener('scroll', throttledScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', throttledScroll);
  }, [loading, dayNums, switchDay, isPrintMode]);

  /* --- themeArt memo to avoid defeating DaySection memo with inline object --- */
  const themeArt = useMemo(() => ({ dark: isDark }), [isDark]);

  /* PR-SS/UU 2026-04-27:embedded mode 把 sheet/download/print handlers 開放
   * 給父層。TripsListPage 的 ⋯ 漢堡選單(共編 / 列印 / 下載)透過 ref 呼叫。
   * v2.17.17:其餘 sheet keys(suggestions/today-route/flights/checklist/
   * backup/emergency/appearance/trip-select)已整批移除 — 只剩 collab 走 sheet。 */
  useImperativeHandle(ref, () => ({
    openSheet: (key: string) => setActiveSheet(key),
    triggerDownload: (format: 'pdf' | 'json') => { void handleDownloadFormat(format); },
    togglePrint,
    openAddStop: () => {
      const tid = trip?.id ?? effectiveUrlTripId;
      if (!tid) return;
      navigate(`/trip/${encodeURIComponent(tid)}/add-stop?day=${currentDayNum}`);
    },
  }), [handleDownloadFormat, togglePrint, trip, effectiveUrlTripId, navigate, currentDayNum]);
  const handleSheetClose = useCallback(() => { setActiveSheet(null); }, []);

  // v2.31.54 simplify follow-up：useMemo 避免每次 TripPage render 重建
  // sheetContent JSX tree → portal subtree React reconcile 浪費。Deps =
  // 實質會影響 TripSheet render 的 props（mapRailData 已是 useMemo stable
  // identity，loading/trip/isDark 是 source state）。
  // v2.31.55 fix：必須放在 early returns 之前，否則 hook order 不一致
  // (loading path vs loaded path call count 不同) → React crash → e2e 全 timeout。
  const sheetContent = useMemo<ReactNode | undefined>(() => (
    !loading && trip ? (
      <Suspense fallback={null}>
        <TripSheet
          tripId={trip.id}
          allPins={mapRailData.allPins}
          pinsByDay={mapRailData.pinsByDay}
          dark={isDark}
        />
      </Suspense>
    ) : undefined
  ), [loading, trip, mapRailData.allPins, mapRailData.pinsByDay, isDark]);

  /* --- Early returns (#13: use hoisted static views) --- */
  if (resolveState.status === 'unpublished') return UNPUBLISHED_VIEW;
  if (resolveState.status === 'loading') return LOADING_VIEW;

  if (error && !trip) {
    return (
      <div className="flex min-h-dvh">
        <div className="flex-1 min-w-0 max-w-full mx-auto">
          <div id="tripContent" style={{ padding: '24px 16px' }}>
            <AlertPanel
              variant="error"
              title="無法載入行程"
              message={`找不到此行程或載入失敗（ID：${activeTripId}）。請確認連結是否正確，或回行程列表挑選其他。`}
              actionLabel="重試"
              onAction={() => setResolveKey((k) => k + 1)}
            />
            <div className="text-center p-10 text-foreground">
              <a className="inline-block py-3 px-6 bg-accent text-accent-foreground rounded-md no-underline font-semibold text-callout transition-[filter] duration-fast ease-apple hover:brightness-110" href="/trips">回行程列表</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 「更多」 sheet 4 action 已遷移新家:
  // 共編 → trip TitleBar；切換行程 → /trips；外觀 → AccountPage；下載 → OverflowMenu
  const bottomNavContent = !loading && trip ? (
    <GlobalBottomNav authed={currentUser !== null} />
  ) : undefined;

  const mainContent = (
    <div className="tp-shell">
      <style>{SCOPED_STYLES}</style>

      {/* v2.17.17:TripPage 永遠透過 TripsListPage embedded mode 渲染(noShell=true)
       * router /trip/:id index 走 TripIndexRedirect → /trips?selected=:id。
       * 既有 standalone TitleBar 區塊整批移除(連同 OverflowMenu 與 6 個 dead
       * sheet entries:suggestions / today-route / flights / checklist /
       * backup / emergency)。共編入口由 TripsListPage 的 EmbeddedActionMenu 提供。 */}

      <ToastContainer />

      <main className="tp-page">
        {/* Section 4.10：persistent offline banner — 取代 useOfflineToast 的
          * 短暫 toast，給 user 一個常駐的「目前在離線模式」 hint */}
        {!isOnline && !loading && trip && (
          <div className="px-padding-h">
            <AlertPanel
              variant="warning"
              title="目前是離線模式"
              message="顯示的是裝置上的快取資料。新增 / 編輯仍會在連線恢復後同步。"
            />
          </div>
        )}
        {!loading && trip && (
          <DayNav
            days={days}
            currentDayNum={currentDayNum}
            onSwitchDay={handleSwitchDay}
            todayDayNum={todayDayNum}
          />
        )}

        {loading && (
          <div className="px-padding-h">
            <DaySkeleton />
            <DaySkeleton />
          </div>
        )}

        {!loading && trip && (
          <div className="trip-content" id="tripContent">
            {/* 2026-07-07 跨天拖拉：統一 DndContext（autoScroll 內建 — 拖到
              * 視窗邊緣自動捲動跨天）。rails 走 dndManaged 模式。 */}
            <DndContext
              sensors={crossDaySensors}
              accessibility={TP_DRAG_ACCESSIBILITY}
              collisionDetection={(args) => railItemsFirstCollision(closestCenter, args)}
              onDragEnd={(e) => void handleCrossDayDragEnd(e)}
            >
              {dayNums.map((dayNum) => (
                <DaySection
                  key={dayNum}
                  dayNum={dayNum}
                  day={allDays[dayNum]}
                  daySummary={daySummaryMap.get(dayNum)}
                  tripStart={tripStart}
                  tripEnd={tripEnd}
                  themeArt={themeArt}
                  localToday={localToday}
                  isActive={dayNum === currentDayNum}
                  timezone={weatherTimezone}
                />
              ))}
            </DndContext>
            {/* Embedded mode (TripsListPage sheet) hides decorative footer art —
              * sheet is a narrow column, art would waste vertical space.
              * Standalone /trip/:id keeps it. Migration 0045 dropped trips.footer
              * → Footer block removed (data-driven block, not the FooterArt SVG). */}
            {!noShell && <FooterArt dark={isDark} />}
          </div>
        )}
      </main>

      {/* v2.17.17:活著的 sheet 只剩 collab(共編設定)— 由 EmbeddedActionMenu
       * onCollab callback OR `?sheet=collab` URL deeplink 觸發 setActiveSheet('collab')。
       * 其餘 8 個 sheet keys 在 v2.17.17 整批移除(無 UI 入口)。 */}
      <InfoSheet
        open={activeSheet === 'collab'}
        title="共編設定"
        onClose={handleSheetClose}
      >
        {trip ? <CollabSheet tripId={trip.id} /> : null}
      </InfoSheet>

      {/* 2026-05-03 modal-to-fullpage migration: AddStopModal 由 /trip/:id/add-stop?day=N
        * page 取代。openAddStop handle 直接 navigate，不再 mount modal。
        * Page 自己 fetch days 取 dayLabel + 處理 region selector。AddStop 完成後
        * dispatch tp-entry-updated event，TripPage 既有 listener (line 277) 觸發
        * refetchCurrentDay。 */}

      {isPrintMode && (
        <button
          className="print-exit-btn hidden fixed top-[10px] left-1/2 -translate-x-1/2 z-(--z-print-exit) bg-destructive text-accent-foreground border-none py-3 px-6 rounded-sm text-callout font-system font-semibold hover:brightness-[0.85] focus-visible:outline-none"
          id="printExitBtn"
          onClick={togglePrint}
        >
          退出列印模式
        </button>
      )}
    </div>
  );

  // Wrap content in TripIdContext so descendants (TimelineEvent, DaySection,
  // TimelineRail) can read tripId without depending on URL useParams — needed
  // for embedded mode where URL is /trips?selected=:id (no :tripId param).
  // v2.10 Wave 1：TripDaysContext 提供 ⎘/⇅ popover 用的 DayOption[] 給 RailRow。
  const wrappedMain = (
    <TripIdContext.Provider value={activeTripId}>
      <TripDaysContext.Provider value={dayOptions}>
        <TripSegmentsContext.Provider value={tripSegmentsContextValue}>
          {mainContent}
        </TripSegmentsContext.Provider>
      </TripDaysContext.Provider>
    </TripIdContext.Provider>
  );

  // Embedded mode: host page provides AppShell + sidebar + sheet portal target + bottomNav.
  // v2.31.46 #143：sheet content 透過 React Portal 掛到 host AppShell 的
  // `<aside id="trip-sheet-portal">` 裡（host 須 AppShell pass `sheetPortalId`），
  // 避開 v2.31.41 callback prop + setState-from-effect 引發的 strict mode race。
  if (noShell) {
    return (
      <>
        {wrappedMain}
        {sheetPortalNode && sheetContent && createPortal(sheetContent, sheetPortalNode)}
      </>
    );
  }

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={wrappedMain}
      sheet={sheetContent}
      bottomNav={bottomNavContent}
    />
  );
}

const TripPage = forwardRef<TripPageHandle, TripPageProps>(TripPageInner);
TripPage.displayName = 'TripPage';
export default TripPage;
