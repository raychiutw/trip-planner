import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { apiFetch } from '../hooks/useApi';
import { lsGet, lsSet, lsRemove, lsRenewAll } from '../lib/localStorage';
import { useTrip } from '../hooks/useTrip';
import { useDarkMode } from '../hooks/useDarkMode';
import { usePrintMode } from '../hooks/usePrintMode';
import DayNav from '../components/trip/DayNav';
import Timeline from '../components/trip/Timeline';
import Hotel from '../components/trip/Hotel';
import Footer, { type FooterData } from '../components/trip/Footer';
import SpeedDial from '../components/trip/SpeedDial';
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
import { DayHeaderArt, DividerArt, FooterArt, NavArt } from '../components/trip/ThemeArt';
import DownloadSheet from '../components/trip/DownloadSheet';
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

/* ===== Module-level constants (#14: hoist inline styles) ===== */

const LOADING_STYLE: React.CSSProperties = { textAlign: 'center', padding: 40, color: 'var(--text-muted)' };
const UNPUBLISHED_STYLE: React.CSSProperties = { color: 'var(--text-muted)', marginTop: 8 };

/* ===== Static early-return views (#13: hoist to module level) ===== */

const NO_TRIP_VIEW = (
  <div className="page-layout">
    <div className="container">
      <div id="tripContent">
        <div className="trip-error">
          <p>請選擇行程</p>
          <a className="trip-error-link" href="setting.html">前往設定頁</a>
        </div>
      </div>
    </div>
  </div>
);

const UNPUBLISHED_VIEW = (
  <div className="page-layout">
    <div className="container">
      <div id="tripContent">
        <div className="trip-error">
          <p>此行程已下架</p>
          <p style={UNPUBLISHED_STYLE}>2 秒後跳轉至設定頁…</p>
        </div>
      </div>
    </div>
  </div>
);

const LOADING_VIEW = (
  <div className="page-layout">
    <div className="container">
      <div id="tripContent">
        <div style={LOADING_STYLE}>載入行程資料中...</div>
      </div>
    </div>
  </div>
);

/* ===== DaySection — memoised per-day renderer (#12) ===== */

interface DaySectionProps {
  dayNum: number;
  day: Day | undefined;
  daySummary: DaySummary | undefined;
  autoScrollDates: string[];
  themeArt?: { theme: 'sun' | 'sky' | 'zen'; dark: boolean };
}

const DaySection = React.memo(function DaySection({
  dayNum,
  day,
  daySummary,
  autoScrollDates,
  themeArt,
}: DaySectionProps) {
  const hotel = day?.hotel;
  const timeline = day?.timeline ?? [];
  // API may return weather_json (raw) or weather (mapped) — handle both
  const weatherRaw = (day as Record<string, unknown> | undefined)?.weather_json ?? day?.weather;
  const weatherDay = weatherRaw && typeof weatherRaw === 'object' && 'locations' in (weatherRaw as object)
    ? (weatherRaw as unknown as WeatherDay)
    : null;
  const dayDate = day?.date ?? daySummary?.date ?? undefined;
  const dayId = day?.id;

  const dayDrivingStats = timeline.length > 0
    ? calcDrivingStats(timeline)
    : null;

  const warnings = validateDay(timeline);

  return (
    <section className="day-section" data-day={dayNum}>
      <div className="day-header info-header" id={`day${dayNum}`} style={{ position: 'relative' }}>
        <h2>Day {dayNum}</h2>
        {daySummary?.label && (
          <span className="day-label">{daySummary.label}</span>
        )}
        {daySummary?.date && (
          <span className="dh-date">
            {daySummary.date}
            {daySummary.day_of_week && `（${daySummary.day_of_week}）`}
          </span>
        )}
        {themeArt && <DayHeaderArt theme={themeArt.theme} dark={themeArt.dark} />}
      </div>
      <div className="day-content" id={`day-slot-${dayNum}`}>
        {!day ? (
          <div className="slot-loading">載入中...</div>
        ) : (
          <>
            {warnings.length > 0 && (
              <div className="trip-warnings">
                <strong><Icon name="warning" /> 注意事項：</strong>
                <ul>
                  {warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
            )}

            {weatherDay && dayDate && dayId && (
              <HourlyWeather
                dayId={dayId}
                dayDate={dayDate}
                weatherDay={weatherDay}
                tripStart={autoScrollDates[0] ?? null}
                tripEnd={autoScrollDates[autoScrollDates.length - 1] ?? null}
              />
            )}

            <div className="day-overview">
              {hotel && <Hotel hotel={toHotelData(hotel as unknown as Record<string, unknown>)} />}
              {dayDrivingStats && (
                <DayDrivingStatsCard stats={dayDrivingStats} />
              )}
            </div>

            {timeline.length > 0 && (
              <Timeline events={timeline.map((e) => toTimelineEntry(e as unknown as Record<string, unknown>))} />
            )}
          </>
        )}
      </div>
    </section>
  );
});

/* ===== URL helpers ===== */

function getUrlTrip(): string | null {
  return new URLSearchParams(window.location.search).get('trip');
}

function setUrlTrip(tripId: string): void {
  const url = new URL(window.location.href);
  if (tripId) url.searchParams.set('trip', tripId);
  else url.searchParams.delete('trip');
  history.replaceState(null, '', url.toString());
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
  suggestions: 'AI 行程建議',
  driving: '交通統計',
  prep: '行前準備',
  'emergency-group': '緊急應變',
  'ai-group': 'AI 分析',
  tools: '設定',
};

/* ===== Resolve state machine ===== */

type ResolveState =
  | { status: 'loading' }
  | { status: 'no-trip' }
  | { status: 'unpublished' }
  | { status: 'resolved'; tripId: string };

/* ===== Component ===== */

export default function TripPage() {
  const [resolveState, setResolveState] = useState<ResolveState>({ status: 'loading' });
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const manualScrollTs = useRef(0);
  const initialScrollDone = useRef(false);
  const scrollDayRef = useRef(0);

  /* --- Dark mode + Print mode (#2: coordinated via shared state) --- */
  const { isDark, setIsDark, colorTheme } = useDarkMode();
  const [downloadOpen, setDownloadOpen] = useState(false);
  const handleDownloadOpen = useCallback(() => setDownloadOpen(true), []);
  const handleDownloadClose = useCallback(() => setDownloadOpen(false), []);

  const { isPrintMode, togglePrint } = usePrintMode({ isDark, setIsDark });

  /* --- lsRenewAll once per session (#9) --- */
  useEffect(() => {
    if (!sessionStorage.getItem('lsRenewed')) {
      lsRenewAll();
      sessionStorage.setItem('lsRenewed', '1');
    }
  }, []);

  /* --- Resolve trip ID from URL / localStorage (#6: cancelled guard) --- */
  useEffect(() => {
    let cancelled = false;
    let tripId = getUrlTrip();
    if (!tripId || !/^[\w-]+$/.test(tripId)) {
      tripId = lsGet<string>('trip-pref');
    }

    if (!tripId) {
      setResolveState({ status: 'no-trip' });
      return;
    }

    apiFetch<TripListItem[]>('/trips')
      .then((trips) => {
        if (cancelled) return;
        const match = trips.find((t) => t.tripId === tripId);
        if (match && match.published === 0) {
          lsRemove('trip-pref');
          setResolveState({ status: 'unpublished' });
          setTimeout(() => { window.location.href = 'setting.html'; }, 2000);
          return;
        }
        setUrlTrip(tripId!);
        lsSet('trip-pref', tripId!);
        setResolveState({ status: 'resolved', tripId: tripId! });
      })
      .catch(() => {
        if (cancelled) return;
        setUrlTrip(tripId!);
        lsSet('trip-pref', tripId!);
        setResolveState({ status: 'resolved', tripId: tripId! });
      });

    return () => { cancelled = true; };
  }, []);

  /* --- Derive active tripId for the hook --- */
  const activeTripId = resolveState.status === 'resolved' ? resolveState.tripId : null;

  const { trip, days, currentDay, currentDayNum, switchDay, allDays, docs, loading, error } =
    useTrip(activeTripId);

  /** Direct download by format (no separate sheet) */
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
    try {
      if (format === 'json') {
        const [meta, fetchedDays] = await Promise.all([
          apiFetch(`/trips/${activeTripId}`),
          apiFetch(`/trips/${activeTripId}/days`),
        ]);
        downloadBlob(JSON.stringify({ meta, days: fetchedDays }, null, 2), `${fileBase}.json`, 'application/json');
      } else if (format === 'md') {
        const [meta, daySummaries] = await Promise.all([
          apiFetch<Record<string, unknown>>(`/trips/${activeTripId}`),
          apiFetch<Array<Record<string, unknown>>>(`/trips/${activeTripId}/days`),
        ]);
        let md = `# ${(meta as Record<string, unknown>).name || tripName}\n\n`;
        for (const ds of daySummaries) {
          const dayData = await apiFetch<Record<string, unknown>>(`/trips/${activeTripId}/days/${ds.day_num}`);
          md += `## Day ${ds.day_num}${ds.label ? ' ' + ds.label : ''}${ds.date ? ' — ' + ds.date : ''}\n\n`;
          const entries = (dayData.entries || []) as Array<Record<string, unknown>>;
          for (const e of entries) { md += `### ${e.time || ''} ${e.title || ''}\n\n`; }
        }
        downloadBlob(md, `${fileBase}.md`, 'text/markdown');
      } else if (format === 'csv') {
        const daySummaries = await apiFetch<Array<Record<string, unknown>>>(`/trips/${activeTripId}/days`);
        const rows: string[][] = [['Day', '日期', '時間', '地點', '評分']];
        for (const ds of daySummaries) {
          const dayData = await apiFetch<Record<string, unknown>>(`/trips/${activeTripId}/days/${ds.day_num}`);
          const entries = (dayData.entries || []) as Array<Record<string, unknown>>;
          for (const e of entries) {
            rows.push([String(ds.day_num), String(ds.date || ''), String(e.time || ''), String(e.title || ''), String(e.rating || '')]);
          }
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
    () => days.map((d) => d.day_num ?? d.id).sort((a, b) => a - b),
    [days],
  );

  /* --- Day summary map for O(1) lookup (#11) --- */
  const daySummaryMap = useMemo(() => {
    const map = new Map<number, DaySummary>();
    for (const d of days) map.set(d.day_num ?? d.id, d);
    return map;
  }, [days]);

  /* --- Auto-scroll dates --- */
  const autoScrollDates = useMemo(
    () => days.map((d) => d.date).filter((d): d is string => !!d).sort(),
    [days],
  );

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

  /* --- Auto-scroll to today or hash on initial load (#3, #5) --- */
  useEffect(() => {
    if (loading || dayNums.length === 0 || initialScrollDone.current) return;
    initialScrollDone.current = true;

    // Check URL hash first
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

    // Auto-scroll to today
    const today = new Date().toISOString().split('T')[0];
    const idx = autoScrollDates.indexOf(today);
    if (idx >= 0 && dayNums[idx]) {
      requestAnimationFrame(() => {
        switchDay(dayNums[idx]);
        scrollToDay(dayNums[idx]);
      });
    }
  }, [loading, dayNums, autoScrollDates, switchDay]);

  /* --- scrollMarginTop dynamic alignment (#7) --- */
  useEffect(() => {
    function align() {
      const nav = document.getElementById('stickyNav');
      if (!nav) return;
      const margin = (nav.offsetHeight + (parseFloat(getComputedStyle(nav).top) || 0) + 4) + 'px';
      document.querySelectorAll('.day-header, .info-header').forEach((h) => {
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

  /* --- Footer data (#4: proper FooterData type) --- */
  const footerData = useMemo((): FooterData | null => {
    if (!trip) return null;
    const raw = trip.footer;
    if (!raw || typeof raw !== 'object') return null;
    return raw as FooterData;
  }, [trip]);

  /* --- Speed Dial → InfoSheet --- */
  const handleSpeedDialItem = useCallback((key: string) => { setActiveSheet(key); }, []);
  const handleSheetClose = useCallback(() => { setActiveSheet(null); }, []);
  const handleGroupClick = useCallback((groupKey: string) => {
    if (groupKey === 'tools') {
      /* tools group opens as action sheet */
      setActiveSheet('tools');
      return;
    }
    setActiveSheet(groupKey);
  }, []);

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
        return suggestionsData ? <Suggestions data={suggestionsData} /> : <p>無行程建議</p>;
      case 'driving':
        return tripDrivingStats
          ? <TripDrivingStatsCard tripStats={tripDrivingStats} />
          : <p>無交通資料</p>;
      /* Grouped content */
      case 'prep':
        return (
          <>
            <div className="info-card">{flightsData ? <Flights data={flightsData} /> : <p>無航班資料</p>}</div>
            <div className="info-card">{checklistData ? <Checklist data={checklistData} /> : <p>無確認清單</p>}</div>
          </>
        );
      case 'emergency-group':
        return (
          <>
            <div className="info-card">{emergencyData ? <Emergency data={emergencyData} /> : <p>無緊急聯絡資料</p>}</div>
            <div className="info-card">{backupData ? <Backup data={backupData} /> : <p>無備案資料</p>}</div>
          </>
        );
      case 'ai-group':
        return (
          <>
            <div className="info-card">{suggestionsData ? <Suggestions data={suggestionsData} /> : <p>無行程建議</p>}</div>
            <div className="info-card">{tripDrivingStats ? <TripDrivingStatsCard tripStats={tripDrivingStats} /> : <p>無交通資料</p>}</div>
          </>
        );
      case 'tools':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0' }}>
            <button className="tool-action-btn" onClick={() => { handleSheetClose(); window.location.href = 'setting.html?section=trip'; }}>
              <Icon name="swap-horiz" /><span>切換行程</span>
            </button>
            <button className="tool-action-btn" onClick={() => { handleSheetClose(); window.location.href = 'setting.html?section=appearance'; }}>
              <Icon name="palette" /><span>外觀與主題</span>
            </button>
            <div className="tool-action-group">
              <div className="tool-action-label">下載行程</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="tool-action-btn tool-action-sm" onClick={() => { handleSheetClose(); window.print(); }}>
                  <Icon name="printer" /><span>PDF</span>
                </button>
                <button className="tool-action-btn tool-action-sm" onClick={() => { handleSheetClose(); handleDownloadFormat('md'); }}>
                  <Icon name="doc" /><span>Markdown</span>
                </button>
                <button className="tool-action-btn tool-action-sm" onClick={() => { handleSheetClose(); handleDownloadFormat('json'); }}>
                  <Icon name="code" /><span>JSON</span>
                </button>
                <button className="tool-action-btn tool-action-sm" onClick={() => { handleSheetClose(); handleDownloadFormat('csv'); }}>
                  <Icon name="table" /><span>CSV</span>
                </button>
              </div>
            </div>
            <button className="tool-action-btn" onClick={() => { handleSheetClose(); togglePrint(); }}>
              <Icon name="printer" /><span>列印模式</span>
            </button>
          </div>
        );
      default:
        return null;
    }
  }, [activeSheet, flightsData, checklistData, backupData, emergencyData, suggestionsData, tripDrivingStats, handleSheetClose, handleDownloadOpen, handleDownloadFormat, togglePrint]);

  /* --- Early returns (#13: use hoisted static views) --- */
  if (resolveState.status === 'no-trip') return NO_TRIP_VIEW;
  if (resolveState.status === 'unpublished') return UNPUBLISHED_VIEW;
  if (resolveState.status === 'loading') return LOADING_VIEW;

  if (error && !trip) {
    return (
      <div className="page-layout">
        <div className="container">
          <div id="tripContent">
            <div className="trip-error">
              <p>行程不存在：{activeTripId}</p>
              <a className="trip-error-link" href="setting.html">選擇其他行程</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Sticky Nav */}
      <div className="sticky-nav" id="stickyNav">
        <span className="nav-brand">{trip?.name || 'Trip Planner'}</span>
        <DayNav days={days} currentDayNum={currentDayNum} onSwitchDay={handleSwitchDay} />
        <NavArt theme={colorTheme} dark={isDark} />
      </div>

      {/* Page Layout */}
      <div className="page-layout">
        <div className="container">
          <div id="tripContent">
            {loading && (
              <div style={LOADING_STYLE}>載入行程資料中...</div>
            )}

            {/* #12: DaySection memo components with #11 Map lookup */}
            {!loading &&
              dayNums.map((dayNum) => (
                <DaySection
                  key={dayNum}
                  dayNum={dayNum}
                  day={allDays[dayNum]}
                  daySummary={daySummaryMap.get(dayNum)}
                  autoScrollDates={autoScrollDates}
                  themeArt={{ theme: colorTheme, dark: isDark }}
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

        {/* Desktop sidebar: Countdown + TripStatsCard only */}
        {!loading && trip && (
          <InfoPanel
            autoScrollDates={autoScrollDates}
            days={loadedDays}
          />
        )}
      </div>

      {/* SpeedDial */}
      {!loading && trip && (
        <SpeedDial onItemClick={handleSpeedDialItem} onGroupClick={handleGroupClick} onPrint={togglePrint} onDownload={handleDownloadOpen} />
      )}

      {/* Download Sheet */}
      {trip && (
        <DownloadSheet
          isOpen={downloadOpen}
          onClose={handleDownloadClose}
          tripId={activeTripId || ''}
          tripName={trip.name || 'trip'}
        />
      )}

      {/* Edit FAB */}
      {!loading && trip && (
        <a className="edit-fab" id="editFab" href="manage/" aria-label="AI 修改行程">
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
        <button className="print-exit-btn" id="printExitBtn" onClick={togglePrint}>
          退出列印模式
        </button>
      )}
    </>
  );
}
