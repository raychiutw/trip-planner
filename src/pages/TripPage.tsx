import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineToast } from '../hooks/useOfflineToast';
import clsx from 'clsx';
import { apiFetch } from '../hooks/useApi';
import { lsGet, lsSet, lsRemove, lsRenewAll, LS_KEY_TRIP_PREF } from '../lib/localStorage';
import { useTrip } from '../hooks/useTrip';
import { useDarkMode, type ColorTheme } from '../hooks/useDarkMode';
import { usePrintMode } from '../hooks/usePrintMode';
import { COLOR_MODE_OPTIONS, THEME_ACCENTS, COLOR_THEMES } from '../lib/appearance';
import DayNav from '../components/trip/DayNav';
import Timeline from '../components/trip/Timeline';

/* DayMap — React.lazy code-split（D1：SDK lazy load）*/
const DayMap = lazy(() => import('../components/trip/DayMap'));
/* TripMap — React.lazy code-split（F006：多天總覽）*/
const TripMap = lazy(() => import('../components/trip/TripMap'));
import Hotel from '../components/trip/Hotel';
import Footer, { type FooterData } from '../components/trip/Footer';
import QuickPanel from '../components/trip/QuickPanel';
import InfoSheet from '../components/trip/InfoSheet';
import InfoPanel from '../components/trip/InfoPanel';
import { DayDrivingStatsCard, TripDrivingStatsCard } from '../components/trip/DrivingStats';
import HourlyWeather from '../components/trip/HourlyWeather';
import Flights from '../components/trip/Flights';
import Checklist from '../components/trip/Checklist';
import Backup from '../components/trip/Backup';
import Emergency from '../components/trip/Emergency';
import Suggestions from '../components/trip/Suggestions';
import Icon from '../components/shared/Icon';
import TriplineLogo from '../components/shared/TriplineLogo';
import Toast from '../components/shared/Toast';
import { FooterArt, NavArt } from '../components/trip/ThemeArt';
import DestinationArt from '../components/trip/DestinationArt';
import DayArt from '../components/trip/DayArt';
import TodayRouteSheet from '../components/trip/TodayRouteSheet';
import DaySkeleton from '../components/trip/DaySkeleton';
import { toTimelineEntry, toHotelData } from '../lib/mapDay';
import { calcTripDrivingStats, calcDrivingStats } from '../lib/drivingStats';
import { validateDay } from '../lib/validateDay';
import type { WeatherDay } from '../lib/weather';
import type { TripListItem, Day, DaySummary } from '../types/trip';
import type { FlightsData } from '../components/trip/Flights';
import type { ChecklistData } from '../components/trip/Checklist';
import type { BackupData } from '../components/trip/Backup';
import type { EmergencyData } from '../components/trip/Emergency';
import type { SuggestionsData } from '../components/trip/Suggestions';

import '../../css/tokens.css';

/* ===== Feature flags ===== */

/** 地圖功能預設隱藏，URL 加 ?showmap=1 顯示 */
const ENABLE_DAY_MAP = new URLSearchParams(window.location.search).get('showmap') === '1';

/* ===== Module-level constants (#14: hoist inline styles) ===== */

const LOADING_CLASS = 'text-center p-10 text-muted';
const UNPUBLISHED_CLASS = 'text-muted mt-2';

/** Pre-built style objects for theme swatches (avoid per-render allocation). */
const SWATCH_STYLES: Record<string, { light: React.CSSProperties; dark: React.CSSProperties }> =
  Object.fromEntries(
    Object.entries(THEME_ACCENTS).map(([key, { light, dark }]) => [
      key,
      { light: { background: light }, dark: { background: dark } },
    ]),
  );

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
/* Print mode */
.print-mode .sticky-nav { display: none; }
.print-mode .edit-fab { display: none !important; }
.print-mode .print-exit-btn { display: block; }
.print-mode #tripContent section { background: var(--color-background) !important; }
.print-mode .day-header { background: var(--color-background); position: relative !important; flex-wrap: wrap; padding: 8px 12px; }
.print-mode .container { max-width: 210mm; margin: 0 auto; box-shadow: var(--shadow-lg); }
@media print {
  .sticky-nav, .edit-fab, .print-exit-btn { display: none !important; }
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

/* ===== DaySection — memoised per-day renderer (#12) ===== */

interface DaySectionProps {
  dayNum: number;
  day: Day | undefined;
  daySummary: DaySummary | undefined;
  tripStart: string | null;
  tripEnd: string | null;
  themeArt?: { theme: ColorTheme; dark: boolean };
  localToday?: string;
  isActive?: boolean;
  /** 全覽模式時隱藏 DayMap（避免與 TripMap 重複）*/
  hideDayMap?: boolean;
}

const DaySection = React.memo(function DaySection({
  dayNum,
  day,
  daySummary,
  tripStart,
  tripEnd,
  themeArt,
  localToday,
  isActive,
  hideDayMap = false,
}: DaySectionProps) {
  /* Track whether this section has been activated to trigger enter animation */
  const [animKey, setAnimKey] = useState(0);
  const prevActiveRef = useRef(false);
  useEffect(() => {
    if (isActive && !prevActiveRef.current) {
      setAnimKey((k) => k + 1);
    }
    prevActiveRef.current = !!isActive;
  }, [isActive]);

  const hotel = day?.hotel;
  const timeline = day?.timeline ?? [];
  // API may return weather_json (raw) or weather (mapped) — handle both
  const dayRecord = day as (Day & Record<string, unknown>) | undefined;
  const weatherRaw = dayRecord && 'weather_json' in dayRecord
    ? dayRecord.weather_json
    : day?.weather;
  const weatherObj = weatherRaw !== null && typeof weatherRaw === 'object' ? weatherRaw : null;
  const weatherDay = weatherObj && 'locations' in weatherObj ? (weatherObj as WeatherDay) : null;
  const dayDate = day?.date ?? daySummary?.date ?? undefined;
  const dayId = day?.id;

  const dayDrivingStats = timeline.length > 0
    ? calcDrivingStats(timeline)
    : null;

  const warnings = validateDay(timeline);

  /* Memoised timeline entries — avoids new array reference on every render */
  const timelineEntries = useMemo(
    () => timeline.map((e) => typeof e === 'object' && e !== null ? toTimelineEntry(e) : toTimelineEntry({})),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day?.timeline],
  );

  return (
    <section className="day-section" data-day={dayNum}>
      <div className="day-header relative z-(--z-day-header) py-2 px-4 flex items-center gap-2 min-h-[100px] rounded-t-md" id={`day${dayNum}`}>
        <h2 className="text-title2 font-bold whitespace-nowrap overflow-hidden text-ellipsis m-0">Day {dayNum}</h2>
        {daySummary?.label && (
          <span>{daySummary.label}</span>
        )}
        {daySummary?.date && (
          <span className="text-subheadline text-muted ml-auto whitespace-nowrap">
            {daySummary.date}
            {daySummary.day_of_week && `（${daySummary.day_of_week}）`}
          </span>
        )}
        {themeArt && <DayArt entries={timeline} dark={themeArt.dark} />}
      </div>
      <div key={animKey} className={clsx('px-padding-h pb-4', animKey > 0 && 'day-content-enter', day && 'day-content-loaded')} id={`day-slot-${dayNum}`}>
        {!day ? (
          <DaySkeleton />
        ) : (
          <>
            {warnings.length > 0 && (
              <div className="bg-destructive-bg py-3 px-4 my-2 rounded-sm text-callout text-destructive">
                <strong><Icon name="warning" /> 注意事項：</strong>
                <ul className="mt-1 ml-4">
                  {warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
            )}

            {weatherDay && dayDate && dayId && (
              <HourlyWeather
                dayId={dayId}
                dayDate={dayDate}
                weatherDay={weatherDay}
                tripStart={tripStart}
                tripEnd={tripEnd}
              />
            )}

            <div className="bg-accent-subtle rounded-sm p-3 mb-3">
              {hotel && typeof hotel === 'object' && <Hotel hotel={toHotelData(hotel)} />}
              {dayDrivingStats && (
                <DayDrivingStatsCard stats={dayDrivingStats} />
              )}
            </div>

            {/* DayMap：DayNav 下方、Timeline 上方（D1：React.lazy + Suspense）
                全覽模式（hideDayMap=true）時隱藏，由 TripMap 取代
                ENABLE_DAY_MAP=false 時完全隱藏（feature flag）*/}
            {ENABLE_DAY_MAP && !hideDayMap && (
              <Suspense fallback={<div className="h-[200px] rounded-sm bg-secondary animate-pulse" aria-label="地圖載入中" />}>
                <DayMap day={day} dayNum={dayNum} />
              </Suspense>
            )}

            {timeline.length > 0 && (
              <Timeline events={timelineEntries} dayDate={dayDate ?? null} localToday={localToday} />
            )}
          </>
        )}
      </div>
    </section>
  );
});

/* ===== Timezone-aware date helper ===== */

/** Known destination timezone mapping (by tripId prefix). */
const TRIP_TIMEZONE: Record<string, string> = {
  okinawa: 'Asia/Tokyo',
  kyoto: 'Asia/Tokyo',
  busan: 'Asia/Seoul',
  banqiao: 'Asia/Taipei',
};

/** Get today's date (YYYY-MM-DD) in the trip's destination timezone. */
function getLocalToday(tripId: string | null): string {
  let tz: string | undefined;
  if (tripId) {
    const prefix = tripId.split('-')[0];
    tz = TRIP_TIMEZONE[prefix];
  }
  if (tz) {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(new Date());
  }
  // Fallback: user's local date
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ===== URL helpers ===== */

// Legacy query-string compat (React Router handles path-based routing)
function getQueryTrip(): string | null {
  return new URLSearchParams(window.location.search).get('trip');
}

/* ===== Scroll helper ===== */

function scrollToDay(dayNum: number): void {
  const header = document.getElementById('day' + dayNum);
  if (!header) return;
  const nav = document.getElementById('stickyNav');
  const navH = nav ? nav.offsetHeight : 0;
  const navTop = nav ? (parseFloat(getComputedStyle(nav).top) || 0) : 0;
  const top = header.getBoundingClientRect().top + window.pageYOffset - navH - navTop - 4;
  window.scrollTo({ top, behavior: 'smooth' });
}

/* ===== Sheet content config ===== */

const SHEET_TITLES: Record<string, string> = {
  flights: '航班資訊',
  checklist: '出發前確認',
  backup: '備案',
  emergency: '緊急聯絡',
  suggestions: 'AI 解籤',
  driving: '交通統計',
  'today-route': '今日路線',
  'trip-select': '切換行程',
  appearance: '外觀與主題',
  prep: '行前準備',
  'emergency-group': '緊急應變',
  'ai-group': 'AI 分析',
};

/* ===== Appearance sheet config — imported from ../lib/appearance ===== */

/* ===== Resolve state machine ===== */

type ResolveState =
  | { status: 'loading' }
  | { status: 'unpublished' }
  | { status: 'resolved'; tripId: string };

/* ===== Component ===== */

export default function TripPage() {
  const { tripId: urlTripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [resolveState, setResolveState] = useState<ResolveState>({ status: 'loading' });
  const [resolveKey, setResolveKey] = useState(0);   /* Fix 5: re-trigger resolve */
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [showNavTitle, setShowNavTitle] = useState(false);
  const largeTitleRef = useRef<HTMLDivElement>(null);
  const manualScrollTs = useRef(0);
  const initialScrollDone = useRef(false);
  const scrollDayRef = useRef(0);

  /* --- Online status + offline/reconnect toasts --- */
  const isOnline = useOnlineStatus();
  const { showOffline, showReconnect } = useOfflineToast(isOnline);
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

  /* --- Dark mode + Print mode (#2: coordinated via shared state) --- */
  const { isDark, setIsDark, colorMode, setColorMode, colorTheme, setTheme } = useDarkMode();

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

  /* --- Large title IntersectionObserver: show inline title when large title scrolls out --- */
  useEffect(() => {
    if (!largeTitleRef.current) return;
    const obs = new IntersectionObserver(
      ([e]) => setShowNavTitle(!e.isIntersecting),
      { threshold: [0] },
    );
    obs.observe(largeTitleRef.current);
    return () => obs.disconnect();
  }, []);

  /* --- Fetch trips when trip-select sheet opens (cached: skip if already loaded) --- */
  useEffect(() => {
    if (activeSheet !== 'trip-select') return;
    if (sheetTrips.length > 0) return;  // 已有快取，不重複請求
    let cancelled = false;
    setSheetTripsLoading(true);
    apiFetch<TripListItem[]>('/trips')
      .then((data) => {
        if (cancelled) return;
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
    let tripId: string | null = (urlTripId && /^[\w-]+$/.test(urlTripId)) ? urlTripId : null;
    if (!tripId) tripId = getQueryTrip();
    if (!tripId || !/^[\w-]+$/.test(tripId)) {
      tripId = lsGet<string>(LS_KEY_TRIP_PREF);
    }

    // Reset scroll tracking for new trip
    initialScrollDone.current = false;

    apiFetch<TripListItem[]>('/trips')
      .then((trips) => {
        if (cancelled) return;

        // 找出預設行程（is_default=1）作為最終 fallback
        const defaultTrip = trips.find((t) => t.is_default === 1);

        // 比對 tripId 是否存在於已發布行程中
        const match = tripId ? trips.find((t) => t.tripId === tripId) : null;

        if (match && match.published === 0) {
          lsRemove(LS_KEY_TRIP_PREF);
          setResolveState({ status: 'unpublished' });
          setTimeout(() => { navigate('/trip/okinawa-trip-2026-Ray', { replace: true }); }, 2000);
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
  }, [resolveKey, urlTripId, navigate]);

  /* --- Derive active tripId for the hook --- */
  const activeTripId = resolveState.status === 'resolved' ? resolveState.tripId : null;

  const { trip, days, currentDay, currentDayNum, switchDay, refetchCurrentDay, allDays, docs, loading, error } =
    useTrip(activeTripId);

  // Keep ref in sync so the online-status effect can call it without a stale closure
  refetchCurrentDayRef.current = refetchCurrentDay;

  /** Direct download by format — complete data export */
  const handleDownloadFormat = useCallback(async (format: string) => {
    if (!activeTripId) return;
    const tripName = trip?.name || 'trip';
    const today = new Date().toISOString().slice(0, 10);
    const fileBase = `${tripName}-${today}`;

    const downloadBlob = (content: string, filename: string, type: string) => {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    };

    // Helper: fetch all data (meta + full days + all docs)
    const DOC_TYPES = ['flights', 'checklist', 'backup', 'emergency', 'suggestions'] as const;

    type RawDayEntry = {
      time?: unknown; title?: unknown; body?: unknown; note?: unknown;
      rating?: unknown; maps?: unknown; source?: unknown;
      travel?: unknown; travel_type?: unknown; travel_desc?: unknown; travel_min?: unknown;
      restaurants?: Record<string, unknown>[];
      shopping?: Record<string, unknown>[];
      [key: string]: unknown;
    };
    type RawHotel = {
      name?: unknown; checkout?: unknown; note?: unknown; breakfast?: unknown;
      parking_json?: unknown; parking?: unknown;
      shopping?: Record<string, unknown>[];
      [key: string]: unknown;
    };
    type RawDay = {
      day_num?: number; date?: string; day_of_week?: string; label?: string;
      hotel?: RawHotel | null;
      timeline?: RawDayEntry[];
      [key: string]: unknown;
    };

    const fetchAllData = async () => {
      // 1. meta + day summaries
      const [meta, daySummaries] = await Promise.all([
        apiFetch<Record<string, unknown>>(`/trips/${activeTripId}`),
        apiFetch<Array<{ day_num: number; date?: string; day_of_week?: string; label?: string }>>(`/trips/${activeTripId}/days`),
      ]);

      // 2. all full days + all docs in parallel
      const [fullDays, docResults] = await Promise.all([
        Promise.all(
          daySummaries.map(ds =>
            apiFetch<RawDay>(`/trips/${activeTripId}/days/${ds.day_num}`)
              .catch(() => null),
          ),
        ),
        Promise.all(
          DOC_TYPES.map(dtype =>
            apiFetch<{ doc_type: string; content: string; updated_at: string }>(`/trips/${activeTripId}/docs/${dtype}`)
              .then(d => {
                let parsed: unknown = d.content;
                if (typeof parsed === 'string') {
                  try { parsed = JSON.parse(parsed); } catch { /* keep as string */ }
                }
                return { type: dtype, data: parsed };
              })
              .catch(() => ({ type: dtype, data: null })),
          ),
        ),
      ]);

      const daysData = fullDays.filter((d): d is RawDay => d !== null);
      const docsMap: Record<string, unknown> = {};
      for (const doc of docResults) {
        if (doc.data !== null) docsMap[doc.type] = doc.data;
      }

      return { meta, daySummaries, daysData, docsMap };
    };

    try {
      if (format === 'json') {
        /* ── JSON: complete dump ── */
        const { meta, daysData, docsMap } = await fetchAllData();
        const output = { meta, days: daysData, docs: docsMap };
        downloadBlob(JSON.stringify(output, null, 2), `${fileBase}.json`, 'application/json');

      } else if (format === 'md') {
        /* ── Markdown: human-readable complete ── */
        const { meta, daysData, docsMap } = await fetchAllData();
        const s = (v: unknown) => (v != null && v !== '') ? String(v) : '';

        let md = `# ${s(meta.name) || tripName}\n`;
        if (meta.title) md += `${s(meta.title)}\n`;
        md += '\n';

        for (const day of daysData) {
          // Day header
          md += `## Day ${day.day_num}`;
          if (day.label) md += ` ${day.label}`;
          if (day.date) {
            md += ` — ${day.date}`;
            if (day.day_of_week) md += `（${day.day_of_week}）`;
          }
          md += '\n\n';

          // Hotel
          const hotel = day.hotel;
          if (hotel?.name) {
            md += `### 🏨 住宿：${s(hotel.name)}\n`;
            if (hotel.checkout) md += `- 退房：${s(hotel.checkout)}\n`;
            if (hotel.breakfast) md += `- 早餐：${typeof hotel.breakfast === 'object' ? JSON.stringify(hotel.breakfast) : s(hotel.breakfast)}\n`;
            const parking = hotel.parking_json ?? hotel.parking;
            if (parking) {
              const pInfo = typeof parking === 'object' ? (parking as Record<string, unknown>).info ?? JSON.stringify(parking) : s(parking);
              md += `- 停車場：${pInfo}\n`;
            }
            if (hotel.note) md += `- 備註：${s(hotel.note)}\n`;

            // Hotel shopping
            const hotelShopping = hotel.shopping;
            if (Array.isArray(hotelShopping) && hotelShopping.length > 0) {
              md += '\n#### 🛍 住宿附近購物\n';
              md += '| 店名 | 類別 | 評分 | 營業時間 | 必買 |\n';
              md += '|------|------|------|---------|------|\n';
              for (const sh of hotelShopping) {
                md += `| ${s(sh.name)} | ${s(sh.category)} | ${s(sh.rating)} | ${s(sh.hours)} | ${s(sh.must_buy)} |\n`;
              }
            }
            md += '\n';
          }

          // Timeline entries
          const timeline = day.timeline ?? [];
          for (let i = 0; i < timeline.length; i++) {
            const e = timeline[i];
            md += `### ${i + 1} ${s(e.time)} ${s(e.title)}`;
            if (e.rating) md += ` ★ ${e.rating}`;
            md += '\n';

            if (e.body) md += `${s(e.body)}\n`;
            if (e.note) md += `\n${s(e.note)}\n`;
            if (e.maps) md += `\n📍 Map: ${s(e.maps)}\n`;

            // Travel
            const travel = e.travel !== null && typeof e.travel === 'object' ? e.travel as Record<string, unknown> : null;
            if (travel?.type || e.travel_type) {
              const tType = s(travel?.type ?? e.travel_type);
              const tDesc = s(travel?.desc ?? e.travel_desc);
              const tMin = travel?.min ?? e.travel_min;
              md += `🚗 → ${tType}`;
              if (tDesc) md += ` ${tDesc}`;
              if (tMin) md += `（${tMin} 分）`;
              md += '\n';
            }

            // Restaurants
            const restaurants = e.restaurants ?? [];
            if (restaurants.length > 0) {
              md += '\n#### 🍽 餐廳推薦\n';
              md += '| 餐廳 | 類別 | 評分 | 價格 | 營業時間 | 備註 |\n';
              md += '|------|------|------|------|---------|------|\n';
              for (const r of restaurants) {
                md += `| ${s(r.name)} | ${s(r.category)} | ${s(r.rating)} | ${s(r.price)} | ${s(r.hours)} | ${s(r.note)} |\n`;
              }
            }

            // Shopping
            const shopping = e.shopping ?? [];
            if (shopping.length > 0) {
              md += '\n#### 🛍 購物推薦\n';
              md += '| 店名 | 類別 | 評分 | 營業時間 | 必買 |\n';
              md += '|------|------|------|---------|------|\n';
              for (const sh of shopping) {
                md += `| ${s(sh.name)} | ${s(sh.category)} | ${s(sh.rating)} | ${s(sh.hours)} | ${s(sh.must_buy)} |\n`;
              }
            }

            md += '\n';
          }
          md += '---\n\n';
        }

        // Docs
        const docLabels: Record<string, string> = {
          flights: '✈️ 航班資訊', checklist: '✅ 出發前確認清單',
          backup: '🔄 備案', emergency: '🚨 緊急聯絡', suggestions: '🔮 AI 解籤',
        };
        for (const dtype of DOC_TYPES) {
          const docData = docsMap[dtype];
          if (!docData) continue;
          md += `## ${docLabels[dtype]}\n\n`;
          md += typeof docData === 'string' ? docData : JSON.stringify(docData, null, 2);
          md += '\n\n';
        }

        downloadBlob(md, `${fileBase}.md`, 'text/markdown');

      } else if (format === 'csv') {
        /* ── CSV: spreadsheet-friendly with expanded rows ── */
        const { daysData, docsMap } = await fetchAllData();
        const s = (v: unknown) => (v != null && v !== '') ? String(v).replace(/\n/g, ' ') : '';

        const headers = [
          'Day', '日期', '星期', '時間', '地點', '評分', '說明', '備註',
          '交通方式', '交通時間(分)', '餐廳名', '餐廳類別', '餐廳評分', '餐廳價格',
          '購物店名', '購物類別', '購物必買', '住宿名', '退房時間',
        ];
        const rows: string[][] = [headers];

        const csvCell = (v: unknown) => s(v);

        for (const day of daysData) {
          const dayNum = s(day.day_num);
          const dayDate = s(day.date);
          const dayWeek = s(day.day_of_week);

          // Hotel row
          const hotel = day.hotel;
          if (hotel?.name) {
            rows.push([
              dayNum, dayDate, dayWeek, '住宿', csvCell(hotel.name), '', '', csvCell(hotel.note),
              '', '', '', '', '', '',
              '', '', '', csvCell(hotel.name), csvCell(hotel.checkout),
            ]);
          }

          // Timeline entries
          const timeline = day.timeline ?? [];
          for (const e of timeline) {
            const travel = e.travel !== null && typeof e.travel === 'object' ? e.travel as Record<string, unknown> : null;
            const travelType = csvCell(travel?.type ?? e.travel_type);
            const travelMin = csvCell(travel?.min ?? e.travel_min);

            const baseRow = [
              dayNum, dayDate, dayWeek, csvCell(e.time), csvCell(e.title),
              csvCell(e.rating), csvCell(e.body), csvCell(e.note),
              travelType, travelMin,
            ];

            const restaurants = e.restaurants ?? [];
            const shopping = e.shopping ?? [];
            const maxNested = Math.max(restaurants.length, shopping.length, 1);

            for (let n = 0; n < maxNested; n++) {
              const r = restaurants[n];
              const sh = shopping[n];
              // For subsequent rows, repeat entry base columns
              const row = n === 0 ? [...baseRow] : [dayNum, dayDate, dayWeek, csvCell(e.time), csvCell(e.title), '', '', '', '', ''];
              // Restaurant columns
              row.push(r ? csvCell(r.name) : '', r ? csvCell(r.category) : '', r ? csvCell(r.rating) : '', r ? csvCell(r.price) : '');
              // Shopping columns
              row.push(sh ? csvCell(sh.name) : '', sh ? csvCell(sh.category) : '', sh ? csvCell(sh.must_buy) : '');
              // Hotel columns (empty for timeline entries)
              row.push('', '');
              rows.push(row);
            }
          }
        }

        // Append docs as separate rows
        const DOC_LABELS: Record<string, string> = {
          flights: '航班資訊', checklist: '出發前確認清單',
          backup: '備案', emergency: '緊急聯絡', suggestions: 'AI 解籤',
        };
        for (const dtype of DOC_TYPES) {
          const docData = docsMap[dtype];
          if (!docData) continue;
          const docStr = typeof docData === 'string' ? docData : JSON.stringify(docData);
          const row = new Array(headers.length).fill('');
          row[0] = '附錄';
          row[3] = DOC_LABELS[dtype] || dtype;
          row[6] = s(docStr);
          rows.push(row);
        }

        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        downloadBlob('\uFEFF' + csv, `${fileBase}.csv`, 'text/csv;charset=utf-8');
      }
    } catch { alert('下載失敗，請稍後再試'); }
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
    () => days.map((d) => d.day_num).sort((a, b) => a - b),
    [days],
  );

  /* --- Day summary map for O(1) lookup (#11) --- */
  const daySummaryMap = useMemo(() => {
    const map = new Map<number, DaySummary>();
    for (const d of days) map.set(d.day_num, d);
    return map;
  }, [days]);

  /* --- Auto-scroll dates --- */
  const autoScrollDates = useMemo(
    () => days.map((d) => d.date).filter((d): d is string => !!d).sort(),
    [days],
  );

  /* --- Trip start/end scalars for HourlyWeather (T3) --- */
  const tripStart = autoScrollDates[0] ?? null;
  const tripEnd = autoScrollDates[autoScrollDates.length - 1] ?? null;

  /* --- Date range for large title subtitle --- */
  const dateRange = useMemo(() => {
    if (autoScrollDates.length === 0) return '';
    if (tripStart === tripEnd) return tripStart ?? '';
    return `${tripStart} — ${tripEnd}`;
  }, [autoScrollDates, tripStart, tripEnd]);

  /* --- Today's date (timezone-aware) — shared by DayNav and Timeline --- */
  const localToday = useMemo(() => getLocalToday(activeTripId), [activeTripId]);

  /* --- Today's day_num for DayNav today marker (timezone-aware) --- */
  const todayDayNum = useMemo(() => {
    const match = days.find((d) => d.date === localToday);
    return match?.day_num;
  }, [days, localToday]);

  /* --- 全覽模式狀態（F006）--- */
  const [isTripMapMode, setIsTripMapMode] = useState(false);

  const handleToggleTripMap = useCallback(() => {
    setIsTripMapMode((prev) => !prev);
  }, []);

  /* --- DayNav click: scroll to day section (#4) --- */
  const handleSwitchDay = useCallback(
    (dayNum: number) => {
      // 切換天數時同時退出全覽模式
      setIsTripMapMode(false);
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
      const hashDay = parseInt(hashMatch[1], 10);
      if (dayNums.includes(hashDay)) {
        requestAnimationFrame(() => {
          switchDay(hashDay);
          scrollToDay(hashDay);
        });
        return;
      }
    }

    // Auto-locate to today (timezone-aware)
    const idx = autoScrollDates.indexOf(localToday);
    if (idx >= 0 && dayNums[idx]) {
      requestAnimationFrame(() => {
        switchDay(dayNums[idx]);
        scrollToDay(dayNums[idx]);
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

  /* --- Scroll tracking: update active pill + hash (#6) --- */
  useEffect(() => {
    if (loading || dayNums.length === 0) return;

    function onScroll() {
      const nav = document.getElementById('stickyNav');
      const navH = nav ? nav.offsetHeight + (parseFloat(getComputedStyle(nav).top) || 0) : 0;
      let current = -1;
      for (let i = 0; i < dayNums.length; i++) {
        const h = document.getElementById('day' + dayNums[i]);
        if (h && h.getBoundingClientRect().top <= navH + 10) current = i;
      }
      if (current >= 0) {
        const activeDayNum = dayNums[current];
        // #1: Only call switchDay when day actually changes (avoid redundant re-renders)
        if (activeDayNum !== scrollDayRef.current) {
          scrollDayRef.current = activeDayNum;
          switchDay(activeDayNum);
        }
        // Update hash (debounced to avoid conflicts with manual scroll)
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

    window.addEventListener('scroll', throttledScroll, { passive: true });
    return () => window.removeEventListener('scroll', throttledScroll);
  }, [loading, dayNums, switchDay]);

  /* --- Docs for InfoSheet (#4: proper types instead of unknown) --- */
  const flightsData = docs.flights as FlightsData | undefined;
  const checklistData = docs.checklist as ChecklistData | undefined;
  const backupData = docs.backup as BackupData | undefined;
  const emergencyData = docs.emergency as EmergencyData | undefined;
  const suggestionsData = docs.suggestions as SuggestionsData | undefined;

  /* --- All loaded days as Day[] (#4: allDays values are already Day) --- */
  const loadedDays = useMemo(
    () => Object.values(allDays),
    [allDays],
  );

  /* --- Trip driving stats --- */
  const tripDrivingStats = useMemo(() => {
    if (loadedDays.length === 0) return null;
    try { return calcTripDrivingStats(loadedDays); } catch { return null; }
  }, [loadedDays]);

  /* --- themeArt memo to avoid defeating DaySection memo with inline object --- */
  const themeArt = useMemo(() => ({ theme: colorTheme, dark: isDark }), [colorTheme, isDark]);

  /* --- Footer data (#4: proper FooterData type) --- */
  const footerData = useMemo((): FooterData | null => {
    if (!trip) return null;
    const raw = trip.footer;
    if (!raw || typeof raw !== 'object') return null;
    return raw as FooterData;
  }, [trip]);

  /* --- QuickPanel → InfoSheet --- */
  const handlePanelItem = useCallback((key: string) => { setActiveSheet(key); }, []);
  const handleSheetClose = useCallback(() => { setActiveSheet(null); }, []);

  /* --- Fix 5: Trip change without full page reload --- */
  const handleTripChange = useCallback((tripId: string) => {
    navigate(`/trip/${tripId}${window.location.search}`, { replace: true });
    lsSet(LS_KEY_TRIP_PREF, tripId);
    setActiveSheet(null);
    setResolveKey((k) => k + 1);
  }, [navigate]);

  /* --- Sheet content (#2: driving shows actual stats) --- */
  const sheetContent = useMemo(() => {
    if (!activeSheet) return null;
    switch (activeSheet) {
      /* Individual content */
      case 'flights':
        return flightsData ? <Flights data={flightsData} /> : <p>無航班資料</p>;
      case 'checklist':
        return checklistData ? <Checklist data={checklistData} /> : <p>無確認清單</p>;
      case 'backup':
        return backupData ? <Backup data={backupData} /> : <p>無備案資料</p>;
      case 'emergency':
        return emergencyData ? <Emergency data={emergencyData} /> : <p>無緊急聯絡資料</p>;
      case 'suggestions':
        return suggestionsData ? <Suggestions data={suggestionsData} /> : <p>AI 沒意見喔</p>;
      case 'today-route':
        return currentDay && currentDay.timeline.length > 0
          ? <TodayRouteSheet events={currentDay.timeline.map((e) => typeof e === 'object' && e !== null ? toTimelineEntry(e) : toTimelineEntry({}))} />
          : <p>無行程資料</p>;
      case 'driving':
        return tripDrivingStats
          ? <TripDrivingStatsCard tripStats={tripDrivingStats} />
          : <p>無交通資料</p>;
      /* Grouped content */
      case 'prep':
        return (
          <>
            <div className="bg-secondary rounded-md p-4 mb-3">{flightsData ? <Flights data={flightsData} /> : <p>無航班資料</p>}</div>
            <div className="bg-secondary rounded-md p-4 mb-3">{checklistData ? <Checklist data={checklistData} /> : <p>無確認清單</p>}</div>
          </>
        );
      case 'emergency-group':
        return (
          <>
            <div className="bg-secondary rounded-md p-4 mb-3">{emergencyData ? <Emergency data={emergencyData} /> : <p>無緊急聯絡資料</p>}</div>
            <div className="bg-secondary rounded-md p-4 mb-3">{backupData ? <Backup data={backupData} /> : <p>無備案資料</p>}</div>
          </>
        );
      case 'ai-group':
        return (
          <>
            <div className="bg-secondary rounded-md p-4 mb-3">{suggestionsData ? <Suggestions data={suggestionsData} /> : <p>AI 沒意見喔</p>}</div>
            <div className="bg-secondary rounded-md p-4 mb-3">{tripDrivingStats ? <TripDrivingStatsCard tripStats={tripDrivingStats} /> : <p>無交通資料</p>}</div>
          </>
        );
      /* Settings sheets */
      case 'trip-select':
        return (
          <div className="max-w-[520px] mx-auto p-padding-h">
            <div className="mb-3">
              <div className="flex flex-col gap-2">
                {sheetTripsLoading && (
                  <div className={LOADING_CLASS}>載入中...</div>
                )}
                {!sheetTripsLoading && sheetTrips.map((t) => (
                  <button
                    key={t.tripId}
                    className={clsx('trip-btn', t.tripId === activeTripId && 'active')}
                    onClick={() => handleTripChange(t.tripId)}
                  >
                    <strong className="block text-title3">{t.name}</strong>
                    {t.title && <span className="text-caption text-muted mt-1 block">{t.title}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      case 'appearance':
        return (
          <div className="max-w-[520px] mx-auto p-padding-h">
            <div className="mb-3">
              <div className="text-footnote font-semibold text-muted uppercase tracking-wider mb-3 pb-2 border-b border-border">色彩模式</div>
              <div className="grid grid-cols-3 gap-3">
                {COLOR_MODE_OPTIONS.map((m) => (
                  <button
                    key={m.key}
                    className={clsx('color-mode-card', m.key === colorMode && 'active')}
                    onClick={() => setColorMode(m.key)}
                  >
                    <div className={`color-mode-preview color-mode-${m.key}`}>
                      <div className="cmp-top"></div>
                      <div className="cmp-bottom">
                        <div className="cmp-input"></div>
                        <div className="cmp-dot"></div>
                      </div>
                    </div>
                    <div className="text-caption text-muted mt-1">{m.label}</div>
                  </button>
                ))}
              </div>
              <div className="text-caption font-semibold text-muted mt-4 mb-2">色彩主題</div>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_THEMES.map((t) => (
                  <button
                    key={t.key}
                    className={clsx('color-theme-card', t.key === colorTheme && 'active')}
                    data-theme={t.key}
                    onClick={() => setTheme(t.key)}
                  >
                    <div
                      className="color-theme-swatch"
                      style={isDark ? SWATCH_STYLES[t.key]?.dark : SWATCH_STYLES[t.key]?.light}
                    />
                    <div className="text-caption text-muted mt-1">{t.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  }, [activeSheet, flightsData, checklistData, backupData, emergencyData, suggestionsData, tripDrivingStats, currentDay, sheetTrips, sheetTripsLoading, activeTripId, handleTripChange, colorMode, setColorMode, colorTheme, setTheme, isDark]);

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

  return (
    <>
      <style>{SCOPED_STYLES}</style>

      {/* Sticky Nav */}
      <div className="sticky-nav sticky top-0 z-(--z-sticky-nav) bg-[color-mix(in_srgb,var(--color-background)_92%,transparent)] backdrop-blur-xl backdrop-saturate-200 shadow-[0_1px_0_var(--color-border)] text-foreground py-3 px-padding-h md:px-6 flex items-center gap-3 overflow-x-hidden overflow-y-visible" id="stickyNav">
        {activeTripId && <DestinationArt tripId={activeTripId} dark={isDark} />}
        <TriplineLogo isOnline={isOnline} />
        <span className={clsx('nav-inline-title text-subheadline font-semibold text-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[160px] md:hidden', showNavTitle && 'visible')}>
          {trip?.title || trip?.name}
        </span>
        <DayNav
          days={days}
          currentDayNum={currentDayNum}
          onSwitchDay={handleSwitchDay}
          todayDayNum={todayDayNum}
          isTripMapMode={isTripMapMode}
          onToggleTripMap={ENABLE_DAY_MAP && days.length > 0 ? handleToggleTripMap : undefined}
        />
        <NavArt theme={colorTheme} dark={isDark} />
      </div>

      {/* Toast notifications — conditionally rendered to avoid hidden DOM nodes */}
      {showOffline && (
        <Toast
          message="已離線 — 顯示快取資料"
          icon="offline"
          visible={showOffline}
        />
      )}
      {showReconnect && (
        <Toast
          message="已恢復連線"
          icon="online"
          visible={showReconnect}
        />
      )}

      {/* Page Layout */}
      <div className="page-layout flex min-h-dvh">
        <div className="container flex-1 min-w-0 max-w-full">
          <div id="tripContent" className="pt-3">
            {/* Large Title (mobile only) */}
            {!loading && trip && (
              <div className="py-2 px-padding-h pb-4 block md:hidden" ref={largeTitleRef}>
                <h1 className="text-large-title font-bold leading-tight text-foreground">{trip.title || trip.name}</h1>
                {dateRange && <p className="text-subheadline text-muted mt-1">{dateRange}</p>}
              </div>
            )}

            {loading && (
              <div className="px-padding-h">
                <DaySkeleton />
                <DaySkeleton />
              </div>
            )}

            {/* TripMap 全覽地圖（F006）：全覽模式時顯示於 DaySections 上方
                ENABLE_DAY_MAP=false 時完全隱藏（feature flag）*/}
            {ENABLE_DAY_MAP && !loading && isTripMapMode && (
              <Suspense fallback={<div className="h-[200px] rounded-sm bg-secondary animate-pulse" aria-label="地圖載入中" />}>
                <TripMap allDays={allDays} dayNums={dayNums} />
              </Suspense>
            )}

            {/* #12: DaySection memo components with #11 Map lookup */}
            {!loading &&
              dayNums.map((dayNum) => (
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
                  hideDayMap={isTripMapMode}
                />
              ))}

            {/* Footer Art */}
            {!loading && <FooterArt theme={colorTheme} dark={isDark} />}

            {/* Footer */}
            {!loading && trip && footerData && (
              <Footer footer={footerData} />
            )}
          </div>
        </div>

        {/* Desktop sidebar: TodaySummary + Hotel + Transport */}
        {!loading && trip && (
          <InfoPanel
            days={loadedDays}
            currentDay={currentDay}
          />
        )}
      </div>

      {/* QuickPanel */}
      {!loading && trip && (
        <QuickPanel
          onItemClick={handlePanelItem}
          onPrint={togglePrint}
          onDownload={handleDownloadFormat}
          isOnline={isOnline}
        />
      )}

      {/* Edit FAB */}
      {!loading && trip && (
        <a
          className={clsx(
            'edit-fab fixed right-5 w-(--fab-size) h-(--fab-size) rounded-full bg-accent text-accent-foreground border-none text-large-title font-light no-underline flex items-center justify-center z-(--z-fab) shadow-md hover:shadow-lg hover:scale-110 transition-[transform,box-shadow] duration-normal ease-apple',
            'bottom-[max(20px,env(safe-area-inset-bottom))]',
            !isOnline && 'opacity-40 pointer-events-none',
          )}
          id="editFab"
          href="/manage/"
          aria-label="AI 修改行程"
          aria-disabled={!isOnline}
          tabIndex={isOnline ? undefined : -1}
          onClick={!isOnline ? (e: React.MouseEvent) => e.preventDefault() : undefined}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </a>
      )}

      {/* InfoSheet (mobile bottom sheet) */}
      <InfoSheet
        open={!!activeSheet}
        title={activeSheet ? (SHEET_TITLES[activeSheet] || '') : ''}
        onClose={handleSheetClose}
      >
        {sheetContent}
      </InfoSheet>

      {/* Print exit button */}
      {isPrintMode && (
        <button
          className="print-exit-btn hidden fixed top-[10px] left-1/2 -translate-x-1/2 z-(--z-print-exit) bg-destructive text-accent-foreground border-none py-3 px-6 rounded-sm text-callout font-system font-semibold hover:brightness-[0.85] focus-visible:outline-none focus-visible:shadow-ring"
          id="printExitBtn"
          onClick={togglePrint}
        >
          退出列印模式
        </button>
      )}
    </>
  );
}
