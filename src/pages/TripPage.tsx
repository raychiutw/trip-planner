import { lazy, Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineToast } from '../hooks/useOfflineToast';
import { apiFetch } from '../lib/apiClient';
import { mapRow } from '../lib/mapRow';
import { lsGet, lsSet, lsRemove, lsRenewAll, LS_KEY_TRIP_PREF } from '../lib/localStorage';
import { useTrip } from '../hooks/useTrip';
import { useDarkMode } from '../hooks/useDarkMode';
import { usePrintMode } from '../hooks/usePrintMode';
import { TRIP_TIMEZONE, getLocalToday } from '../lib/constants';
import { downloadTripFormat } from '../lib/tripExport';
import { computeActiveDayIndex, getStableViewportH, computeInitialHash } from '../lib/scrollSpy';
import { useScrollRestoreOnBack } from '../hooks/useScrollRestoreOnBack';
import { TripIdContext } from '../contexts/TripIdContext';
import DayNav from '../components/trip/DayNav';
import DaySection from '../components/trip/DaySection';
import TripSheetContent, { SHEET_TITLES } from '../components/trip/TripSheetContent';
import { extractPinsFromDay } from '../hooks/useMapData';
/* F005: TripSheet 延遲載（內部 lazy load TripMapRail 以避免 Leaflet 進首頁 bundle）*/
const TripSheet = lazy(() => import('../components/trip/TripSheet'));
import Footer, { type FooterData } from '../components/trip/Footer';
import OverflowMenu from '../components/trip/OverflowMenu';
import BottomNavBar from '../components/shell/BottomNavBar';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import InfoSheet from '../components/trip/InfoSheet';
import ToastContainer from '../components/shared/Toast';
import { FooterArt } from '../components/trip/ThemeArt';
import DestinationArt from '../components/trip/DestinationArt';
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

export default function TripPage({ tripId: propTripId, noShell = false }: TripPageProps = {}) {
  const { tripId: urlTripId } = useParams<{ tripId: string }>();
  // Prefer prop tripId (embedded mode) over URL (route mode).
  const effectiveUrlTripId = propTripId ?? urlTripId;
  const navigate = useNavigate();
  const [resolveState, setResolveState] = useState<ResolveState>({ status: 'loading' });
  const [resolveKey, setResolveKey] = useState(0);   /* Fix 5: re-trigger resolve */
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
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
          <div id="tripContent">
            <div className="text-center p-10 text-foreground">
              <p className="mb-4 text-title2">行程不存在：{activeTripId}</p>
              <a className="inline-block py-3 px-6 bg-accent text-accent-foreground rounded-md no-underline font-semibold text-callout transition-[filter] duration-fast ease-apple hover:brightness-110" href="/">選擇其他行程</a>
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

  const bottomNavContent = !loading && trip ? (
    <BottomNavBar
      tripId={trip.id}
      activeSheet={activeSheet}
      onOpenSheet={setActiveSheet}
      onClearSheet={() => setActiveSheet(null)}
      isOnline={isOnline}
    />
  ) : undefined;

  const mainContent = (
    <div className="ocean-shell">
      <style>{SCOPED_STYLES}</style>

      {/* Topbar only renders in standalone (route) mode. When embedded inside
        * TripsListPage, the host provides the chrome — render only the inner
        * timeline + day nav so it matches mobile layout exactly. */}
      {!noShell && (
        <header className="ocean-topbar sticky-nav" id="stickyNav">
          <div className="ocean-topbar-left">
            {activeTripId && <DestinationArt tripId={activeTripId} dark={isDark} />}
            {trip && <span className="ocean-brand-label">{trip.title || trip.name}</span>}
          </div>
          <div className="ocean-topbar-right">
            <button type="button" className="ocean-tb-btn" onClick={() => setActiveSheet('emergency')}>
              <span aria-hidden="true">!</span>
              <span className="ocean-tb-label">緊急</span>
            </button>
            <button type="button" className="ocean-tb-btn" onClick={togglePrint}>
              <span aria-hidden="true">⎙</span>
              <span className="ocean-tb-label">列印</span>
            </button>
            <OverflowMenu
              onSheet={handlePanelItem}
              onDownload={handleDownloadFormat}
              isOnline={isOnline}
            />
          </div>
        </header>
      )}

      <ToastContainer />

      <main className="ocean-page">
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
  const wrappedMain = (
    <TripIdContext.Provider value={activeTripId}>
      {mainContent}
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
