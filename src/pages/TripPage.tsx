import { lazy, Suspense, useState, useEffect, useMemo, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon from '../components/shared/Icon';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineToast } from '../hooks/useOfflineToast';
import { apiFetch } from '../lib/apiClient';
import { mapRow } from '../lib/mapRow';
import { lsGet, lsSet, lsRemove, lsRenewAll, LS_KEY_TRIP_PREF } from '../lib/localStorage';
import { useActiveTrip } from '../contexts/ActiveTripContext';
import { useTrip } from '../hooks/useTrip';
import { useDarkMode } from '../hooks/useDarkMode';
import { usePrintMode } from '../hooks/usePrintMode';
import { TRIP_TIMEZONE, getLocalToday } from '../lib/constants';
import { downloadTripFormat } from '../lib/tripExport';
import { computeActiveDayIndex, getStableViewportH, computeInitialHash } from '../lib/scrollSpy';
import { useScrollRestoreOnBack } from '../hooks/useScrollRestoreOnBack';
import { TripIdContext } from '../contexts/TripIdContext';
import { TripDaysContext } from '../contexts/TripDaysContext';
import type { DayOption } from '../components/trip/EntryActionPopover';
import DayNav from '../components/trip/DayNav';
import DaySection from '../components/trip/DaySection';
import TripSheetContent, { SHEET_TITLES } from '../components/trip/TripSheetContent';
import { extractPinsFromDay } from '../hooks/useMapData';
/* F005: TripSheet 延遲載（內部 lazy load TripMapRail 以避免 Leaflet 進首頁 bundle）*/
const TripSheet = lazy(() => import('../components/trip/TripSheet'));
import Footer, { type FooterData } from '../components/trip/Footer';
import OverflowMenu from '../components/trip/OverflowMenu';
import AlertPanel from '../components/shared/AlertPanel';
import AddStopModal from '../components/trip/AddStopModal';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import { useCurrentUser } from '../hooks/useCurrentUser';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import TitleBar from '../components/shell/TitleBar';
import InfoSheet from '../components/trip/InfoSheet';
import ToastContainer from '../components/shared/Toast';
import { FooterArt } from '../components/trip/ThemeArt';
import DaySkeleton from '../components/trip/DaySkeleton';
import type { TripListItem } from '../types/trip';

import '../../css/tokens.css';

/* ===== Module-level constants (#14: hoist inline styles) ===== */

const UNPUBLISHED_CLASS = 'text-muted mt-2';

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
/* Sticky-nav children z-index layering above DestinationArt */
.sticky-nav > :not([aria-hidden="true"]) { position: relative; z-index: 1; }

.trip-content { min-width: 0; }

.tp-trip-titlebar-action {
  height: var(--spacing-tap-min, 44px);
  min-width: var(--spacing-tap-min, 44px);
  padding: 0 14px;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-foreground);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: var(--font-size-footnote);
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms, color 120ms;
}
.tp-trip-titlebar-action:hover {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
}
.tp-trip-titlebar-action:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.tp-trip-titlebar-action .svg-icon { width: 20px; height: 20px; }
@media (max-width: 1023px) {
  .tp-trip-titlebar-action { padding: 0; min-width: var(--spacing-tap-min, 44px); width: var(--spacing-tap-min, 44px); }
  .tp-trip-titlebar-action-label { display: none; }
}
.tp-titlebar .ocean-tb-btn {
  width: var(--spacing-tap-min, 44px);
  height: var(--spacing-tap-min, 44px);
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-foreground);
  display: inline-grid;
  place-items: center;
}
.tp-titlebar .ocean-tb-btn:hover {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
}
.tp-titlebar .ocean-tb-btn > span[aria-hidden="true"] { display: none; }
.tp-titlebar .ocean-tb-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.tp-titlebar .ocean-tb-btn::before {
  content: "⋯";
  font-size: 24px;
  line-height: 1;
  font-weight: 700;
}
@media (max-width: 760px) {
  .tp-trip-titlebar-action[data-compact-hidden="true"] { display: none; }
}

/* Print mode */
.print-mode .sticky-nav { display: none; }
.print-mode .ocean-tb-btn { display: none !important; }
.print-mode .print-exit-btn { display: block; }
.print-mode .page-layout { padding-right: 0 !important; }
.print-mode #tripContent section { background: var(--color-background) !important; }
.print-mode .day-header { background: var(--color-background); position: relative !important; flex-wrap: wrap; padding: 8px 12px; }
.print-mode .container { max-width: 210mm; margin: 0 auto; box-shadow: var(--shadow-lg); }
@media print {
  .sticky-nav, .print-exit-btn { display: none !important; }
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
  triggerDownload: (format: string) => void;
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
  const [addStopOpen, setAddStopOpen] = useState(false);
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

  // Refresh stale data when connection is restored
  const prevIsOnlineRef = useRef(isOnline);
  useEffect(() => {
    if (!prevIsOnlineRef.current && isOnline) {
      refetchCurrentDayRef.current?.();
    }
    prevIsOnlineRef.current = isOnline;
  }, [isOnline]);

  // V3 inline expansion (PR2): TimelineRail dispatches `tp-entry-updated`
  // on successful note PATCH. We refetch the current day to surface the new
  // value across the timeline + map + sheet.
  useEffect(() => {
    function onEntryUpdated() {
      refetchCurrentDayRef.current?.();
    }
    window.addEventListener('tp-entry-updated', onEntryUpdated);
    return () => window.removeEventListener('tp-entry-updated', onEntryUpdated);
  }, []);

  /* --- Dark mode + Print mode (#2: coordinated via shared state) --- */
  const { isDark, setIsDark, colorMode, setColorMode } = useDarkMode();

  /* --- Trips list for trip-select sheet --- */
  const [sheetTrips, setSheetTrips] = useState<TripListItem[]>([]);
  const [sheetTripsLoading, setSheetTripsLoading] = useState(false);

  const { isPrintMode, togglePrint } = usePrintMode({ isDark, setIsDark });

  /* --- lsRenewAll once per session (#9) --- */
  useEffect(() => {
    if (!sessionStorage.getItem('lsRenewed')) {
      lsRenewAll();
      sessionStorage.setItem('lsRenewed', '1');
    }
  }, []);

  /* --- Fetch trips when trip-select sheet opens (cached: skip if already loaded) --- */
  useEffect(() => {
    if (activeSheet !== 'trip-select') return;
    if (sheetTrips.length > 0) return;  // 已有快取，不重複請求
    let cancelled = false;
    setSheetTripsLoading(true);
    apiFetch<Record<string, unknown>[]>('/trips')
      .then((raw) => {
        if (cancelled) return;
        const data = raw.map(r => mapRow(r)) as unknown as TripListItem[];
        setSheetTrips(data.filter((t) => t.published === 1));
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        if (!cancelled) setSheetTripsLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeSheet, sheetTrips.length]);

  /* --- Resolve trip ID from URL / localStorage / default (#6: cancelled guard) --- */
  /* Fix 5: resolveKey in deps allows re-triggering without full page reload */
  useEffect(() => {
    let cancelled = false;
    // Priority 1: React Router params (/trip/:tripId)
    // Priority 2: legacy query string ?trip=xxx
    // Priority 3: localStorage
    let tripId: string | null = (effectiveUrlTripId && /^[\w-]+$/.test(effectiveUrlTripId)) ? effectiveUrlTripId : null;
    if (!tripId) tripId = getQueryTrip();
    if (!tripId || !/^[\w-]+$/.test(tripId)) {
      tripId = lsGet<string>(LS_KEY_TRIP_PREF);
    }

    // Reset scroll tracking for new trip
    initialScrollDone.current = false;

    apiFetch<Record<string, unknown>[]>('/trips')
      .then((raw) => {
        if (cancelled) return;
        const trips = raw.map(r => mapRow(r)) as unknown as TripListItem[];

        // 找出預設行程（isDefault=1）作為最終 fallback
        const defaultTrip = trips.find((t) => t.isDefault === 1);

        // 比對 tripId 是否存在於已發布行程中
        const match = tripId ? trips.find((t) => t.tripId === tripId) : null;

        if (match && match.published === 0) {
          lsRemove(LS_KEY_TRIP_PREF);
          setResolveState({ status: 'unpublished' });
          setTimeout(() => { navigate(defaultTrip ? `/trip/${defaultTrip.tripId}` : '/', { replace: true }); }, 2000);
          return;
        }

        if (!match && !defaultTrip) {
          setResolveState({ status: 'unpublished' });
          return;
        }

        // 優先用 URL/localStorage 比對到的行程，比對不到則用預設行程
        const resolvedId = match ? match.tripId : defaultTrip!.tripId;

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

  const { trip, days, currentDay, currentDayNum, switchDay, refetchCurrentDay, allDays, docs, loading, error } =
    useTrip(activeTripId);

  // Keep ref in sync so the online-status effect can call it without a stale closure
  refetchCurrentDayRef.current = refetchCurrentDay;

  /** Direct download by format — delegates to tripExport module */
  const handleDownloadFormat = useCallback(async (format: string) => {
    if (!activeTripId) return;
    await downloadTripFormat(format, { tripId: activeTripId, trip });
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
    if (trip?.ogDescription) {
      document.querySelector('meta[property="og:description"]')?.setAttribute('content', trip.ogDescription);
    }
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

    // PR-Q 2026-04-26：?sheet=<key> URL param — 從 /trips card kebab「共編
    // 設定」過來，自動開該 sheet。允許的 key 必須在 SHEET_TITLES 內。
    const sheetParam = new URLSearchParams(window.location.search).get('sheet');
    if (sheetParam && Object.prototype.hasOwnProperty.call(SHEET_TITLES, sheetParam)) {
      setActiveSheet(sheetParam);
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
    if (todayDayNum !== undefined) {
      requestAnimationFrame(() => {
        switchDay(todayDayNum);
        scrollToDay(todayDayNum);
        // Scroll to [data-now] if it exists (delayed for DOM update)
        setTimeout(() => {
          const nowEl = document.querySelector('[data-now]');
          if (nowEl) {
            nowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      });
    }
  }, [loading, dayNums, autoScrollDates, switchDay, localToday]);

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

  /* --- Stops count per day for DayNav progress marks --- */
  const stopsByDay = useMemo(() => {
    const map: Record<number, number> = {};
    for (const dayNum of dayNums) {
      const day = allDays[dayNum];
      if (day) map[dayNum] = day.timeline.length;
    }
    return map;
  }, [allDays, dayNums]);

  /* --- themeArt memo to avoid defeating DaySection memo with inline object --- */
  const themeArt = useMemo(() => ({ dark: isDark }), [isDark]);

  /* --- Footer data (#4: proper FooterData type) --- */
  const footerData = useMemo((): FooterData | null => {
    if (!trip) return null;
    const raw = trip.footer;
    if (!raw || typeof raw !== 'object') return null;
    return raw as FooterData;
  }, [trip]);

  /* --- Topbar / OverflowMenu -> InfoSheet --- */
  const handlePanelItem = useCallback((key: string) => { setActiveSheet(key); }, []);

  /* PR-SS/UU 2026-04-27：embedded mode 把 sheet/download/print handlers 開放
   * 給父層。TripsListPage 的 ⋯ 漢堡選單 (共編 / 列印 / 下載) 透過 ref 呼叫。 */
  useImperativeHandle(ref, () => ({
    openSheet: (key: string) => setActiveSheet(key),
    triggerDownload: (format: string) => { void handleDownloadFormat(format); },
    togglePrint,
    openAddStop: () => setAddStopOpen(true),
  }), [handleDownloadFormat, togglePrint]);
  const handleSheetClose = useCallback(() => { setActiveSheet(null); }, []);

  /* --- Fix 5: Trip change without full page reload --- */
  const handleTripChange = useCallback((tripId: string) => {
    // scrollDayRef 在 scroll tracking 內作為 dedup guard，跨行程沒 reset 會讓
    // 新行程載入後若首日 dayNum 相同就不觸發 switchDay，造成 hash 殘留舊值。
    scrollDayRef.current = 0;
    navigate(`/trip/${tripId}${window.location.search}`, { replace: true });
    lsSet(LS_KEY_TRIP_PREF, tripId);
    setActiveSheet(null);
    setResolveKey((k) => k + 1);
  }, [navigate]);

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

  const sheetContent = !loading && trip ? (
    <Suspense fallback={null}>
      <TripSheet
        tripId={trip.id}
        allPins={mapRailData.allPins}
        pinsByDay={mapRailData.pinsByDay}
        dark={isDark}
      />
    </Suspense>
  ) : undefined;

  // Section 5 (E4)：trip-scoped 4-tab BottomNavBar 退役，全 page 統一用
  // 5-tab GlobalBottomNav。「更多」 sheet 4 action 已遷移新家：
  // 共編 → trip TitleBar；切換行程 → /trips；外觀 → AccountPage；下載 → OverflowMenu
  const bottomNavContent = !loading && trip ? (
    <GlobalBottomNav authed={!!currentUser} />
  ) : undefined;

  const mainContent = (
    <div className="ocean-shell">
      <style>{SCOPED_STYLES}</style>

      {/* Topbar only renders in standalone (route) mode. When embedded inside
        * TripsListPage, the host provides the chrome — render only the inner
        * timeline + day nav so it matches mobile layout exactly. */}
      {!noShell && (
        <TitleBar
          id="stickyNav"
          className="sticky-nav"
          title={trip?.title || trip?.name || '行程詳情'}
          back={() => navigate('/trips')}
          backLabel="返回行程列表"
          actions={
            <>
              <button
                type="button"
                className="tp-trip-titlebar-action"
                onClick={() => setAddStopOpen(true)}
                aria-label={`在 Day ${currentDayNum || 1} 加景點`}
                title="加入景點"
                data-testid="trip-add-stop-trigger"
              >
                <Icon name="plus" />
                <span className="tp-trip-titlebar-action-label">加景點</span>
              </button>
              <button
                type="button"
                className="tp-trip-titlebar-action"
                data-compact-hidden="true"
                onClick={() => setActiveSheet('suggestions')}
                aria-label="開啟 AI 建議"
                title="AI 建議"
              >
                <Icon name="lightbulb" />
                <span className="tp-trip-titlebar-action-label">建議</span>
              </button>
              <button
                type="button"
                className="tp-trip-titlebar-action"
                data-compact-hidden="true"
                onClick={() => setActiveSheet('collab')}
                aria-label="開啟共編設定"
                title="共編"
              >
                <Icon name="group" />
                <span className="tp-trip-titlebar-action-label">共編</span>
              </button>
              <button
                type="button"
                className="tp-trip-titlebar-action"
                data-compact-hidden="true"
                onClick={() => { void handleDownloadFormat('pdf'); }}
                aria-label="下載行程"
                title="下載"
              >
                <Icon name="download" />
                <span className="tp-trip-titlebar-action-label">下載</span>
              </button>
              <OverflowMenu
                onSheet={handlePanelItem}
                onDownload={handleDownloadFormat}
                isOnline={isOnline}
              />
            </>
          }
        />
      )}

      <ToastContainer />

      <main className="ocean-page">
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
            stopsByDay={stopsByDay}
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
            {/* Embedded mode (TripsListPage sheet) hides decorative footer
              * art + Footer block — sheet is a narrow column, footer would
              * waste vertical space. Standalone /trip/:id keeps both. */}
            {!noShell && (
              <>
                <FooterArt dark={isDark} />
                {footerData && <Footer footer={footerData} />}
              </>
            )}
          </div>
        )}
      </main>

      <InfoSheet
        open={!!activeSheet}
        title={activeSheet ? (SHEET_TITLES[activeSheet] || '') : ''}
        onClose={handleSheetClose}
      >
        <TripSheetContent
          activeSheet={activeSheet}
          docs={docs}
          currentDay={currentDay}
          sheetTrips={sheetTrips}
          sheetTripsLoading={sheetTripsLoading}
          activeTripId={activeTripId}
          onTripChange={handleTripChange}
          colorMode={colorMode}
          setColorMode={setColorMode}
          onOpenSheet={setActiveSheet}
          onPrint={togglePrint}
          onDownload={handleDownloadFormat}
          isOnline={isOnline}
        />
      </InfoSheet>

      {/* Section 3：trip-level「+ 加景點」 modal — 帶 currentDayNum，user 完成
        * commit 後 AddStopModal 內部 dispatch tp-entry-updated，TripPage 既有
        * listener (line 277) 會觸發 refetchCurrentDay。 */}
      {trip && currentDayNum > 0 && (
        <AddStopModal
          open={addStopOpen}
          tripId={trip.id}
          dayNum={currentDayNum}
          dayLabel={(() => {
            const day = days.find((d) => d.dayNum === currentDayNum);
            const date = day?.date ? day.date : '';
            return date ? `Day ${currentDayNum} · ${date}` : `Day ${currentDayNum}`;
          })()}
          onClose={() => setAddStopOpen(false)}
        />
      )}

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
        {mainContent}
      </TripDaysContext.Provider>
    </TripIdContext.Provider>
  );

  // Embedded mode: host page provides AppShell + sidebar + sheet + bottomNav.
  if (noShell) {
    return wrappedMain;
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
